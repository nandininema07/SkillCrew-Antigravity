"""Scheduled Sparky engagement: learning digests, streak nudges, inactivity voice/WhatsApp.

Invoke via POST /api/cron/sparky/* with header X-Cron-Secret (CRON_SECRET or BACKEND_AGENT_SECRET).
Uses Supabase service role + Sparky compose + Twilio / Resend.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sparky_agent import (
    compose_engagement,
    dispatch_resend_plain_email,
    dispatch_twilio,
)

logger = logging.getLogger(__name__)

INACTIVITY_DAYS = 3
INACTIVITY_CALL_COOLDOWN_DAYS = 7
DIGEST_MIN_HOURS_BETWEEN = 20
CHAMPION_XP_MIN = 400
CHAMPION_STREAK_MIN = 5


def normalize_phone_e164(raw: str | None, default_cc: str = "1") -> str | None:
    """Best-effort E.164; Twilio requires + prefix for most regions."""
    if not raw or not str(raw).strip():
        return None
    s = re.sub(r"[\s\-\(\)]", "", str(raw).strip())
    if s.startswith("+"):
        digits = s[1:]
        return f"+{digits}" if digits.isdigit() else None
    if s.startswith("00") and s[2:].isdigit():
        return f"+{s[2:]}"
    if s.isdigit():
        if len(s) == 10 and default_cc == "1":
            return f"+1{s}"
        if len(s) == 11 and s.startswith("1"):
            return f"+{s}"
        return f"+{s}"
    return None


def _utc_today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _iso_range_last_hours(hours: int) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)
    return start.isoformat(), now.isoformat()


def _same_calendar_utc(iso_ts: str | None, day_iso: str) -> bool:
    if not iso_ts:
        return False
    try:
        dt = datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.date().isoformat() == day_iso
    except Exception:
        return False


def _collect_learning_snapshot(
    supabase: Any,
    user_id: str,
    since_iso: str,
    until_iso: str,
) -> dict[str, Any]:
    """Aggregate module completions, assessments, new skills, and general activity in the window."""
    lines: list[str] = []
    roadmap_ids: set[str] = set()
    total_time_minutes = 0
    total_xp_earned = 0

    try:
        mc = (
            supabase.table("module_completion_track")
            .select("module_id, roadmap_id, completed_at, skills_acquired, time_spent_minutes, status")
            .eq("user_id", user_id)
            .eq("status", "completed")
            .gte("completed_at", since_iso)
            .lte("completed_at", until_iso)
            .execute()
        )
        rows = mc.data or []
        for r in rows:
            rid = r.get("roadmap_id")
            if rid:
                roadmap_ids.add(str(rid))
            skills = r.get("skills_acquired") or []
            sk_txt = ", ".join(skills[:5]) if isinstance(skills, list) else ""
            mid = r.get("module_id") or "module"
            tm = r.get("time_spent_minutes")
            if tm:
                total_time_minutes += tm
            extra = f" ({tm} min)" if tm else ""
            lines.append(f"📚 Completed {mid}{extra}" + (f" — learned: {sk_txt}" if sk_txt else ""))
    except Exception as e:
        logger.debug("module_completion_track query: %s", e)

    try:
        ap = (
            supabase.table("assessment_performance")
            .select("xp_earned, score, completed_at, roadmap_id")
            .eq("user_id", user_id)
            .gte("completed_at", since_iso)
            .lte("completed_at", until_iso)
            .execute()
        )
        for r in ap.data or []:
            xp = r.get("xp_earned") or 0
            total_xp_earned += xp
            sc = r.get("score")
            lines.append(f"✅ Quiz: scored {sc}%, earned {xp} XP")
    except Exception as e:
        logger.debug("assessment_performance query: %s", e)

    try:
        sk = (
            supabase.table("skills")
            .select("name, proficiency_level")
            .eq("user_id", user_id)
            .gte("created_at", since_iso)
            .lte("created_at", until_iso)
            .execute()
        )
        new_skills = []
        for r in sk.data or []:
            n = r.get("name")
            proficiency = r.get("proficiency_level") or "intermediate"
            if n:
                new_skills.append(n)
                lines.append(f"⭐ Added skill: {n}")
        if len(new_skills) > 3:
            lines = [l for l in lines if not l.startswith("⭐")]
            lines.insert(0, f"⭐ Added {len(new_skills)} new skills: {', '.join(new_skills[:5])}")
    except Exception as e:
        logger.debug("skills query: %s", e)

    titles: dict[str, str] = {}
    if roadmap_ids:
        try:
            rm = (
                supabase.table("user_archie_roadmaps")
                .select("id, display_title")
                .in_("id", list(roadmap_ids))
                .execute()
            )
            for row in rm.data or []:
                titles[str(row["id"])] = str(row.get("display_title") or "Roadmap")
        except Exception as e:
            logger.debug("roadmap titles: %s", e)

    return {
        "lines": lines,
        "roadmap_titles": titles,
        "total_time_minutes": total_time_minutes,
        "total_xp_earned": total_xp_earned,
    }


def _digest_text(snapshot: dict[str, Any]) -> str:
    """Generate a floating summary of learning accomplishments."""
    lines = snapshot.get("lines") or []
    total_time = snapshot.get("total_time_minutes") or 0
    total_xp = snapshot.get("total_xp_earned") or 0
    
    if not lines and total_time == 0 and total_xp == 0:
        return ""
    
    # Build narrative summary
    summary_parts = []
    
    # Add activity items (limit to top 8)
    if lines:
        summary_parts.extend(lines[:8])
    
    # Add time spent summary if available
    if total_time > 0:
        hours = total_time // 60
        mins = total_time % 60
        if hours > 0:
            summary_parts.append(f"⏱️ Total focus time: {hours}h {mins}m")
        else:
            summary_parts.append(f"⏱️ Total focus time: {mins} minutes")
    
    # Add XP summary if available
    if total_xp > 0:
        summary_parts.append(f"🎯 Total XP gained: +{total_xp}")
    
    if not summary_parts:
        return ""
    
    # Format as a nice bullet list
    return "\n".join(f"• {x}" for x in summary_parts[:12])


def _xp_rank_and_total(supabase: Any, user_xp: int) -> tuple[int, int]:
    try:
        higher = supabase.table("profiles").select("id", count="exact").gt("xp", int(user_xp)).execute()
        rank = int(getattr(higher, "count", None) or 0) + 1
    except Exception as e:
        logger.debug("xp rank: %s", e)
        rank = 1
    try:
        tot = supabase.table("profiles").select("id", count="exact").execute()
        total = int(getattr(tot, "count", None) or 0)
    except Exception as e:
        logger.debug("xp total: %s", e)
        total = 0
    return rank, max(total, 1)


def _recent_quiz_avg(supabase: Any, user_id: str, limit: int = 5) -> float | None:
    try:
        ap = (
            supabase.table("assessment_performance")
            .select("score")
            .eq("user_id", user_id)
            .order("completed_at", desc=True)
            .limit(limit)
            .execute()
        )
        scores: list[float] = []
        for r in ap.data or []:
            s = r.get("score")
            if s is not None:
                scores.append(float(s))
        if not scores:
            return None
        return sum(scores) / len(scores)
    except Exception as e:
        logger.debug("quiz avg: %s", e)
        return None


def _todays_focus_from_roadmap(supabase: Any, user_id: str) -> tuple[str, str]:
    """Returns (roadmap_title, focus_line)."""
    try:
        r = (
            supabase.table("user_archie_roadmaps")
            .select("display_title, roadmap_kind, bundles_raw, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = r.data or []
    except Exception as e:
        logger.debug("roadmap fetch: %s", e)
        return ("Your learning path", "Open the app for your next step.")

    if not rows:
        return ("Your learning path", "Pick a roadmap and complete one small lesson today.")

    row = rows[0]
    title = str(row.get("display_title") or "Your roadmap")
    kind = str(row.get("roadmap_kind") or "job_ready")
    br = row.get("bundles_raw")
    if isinstance(br, str):
        try:
            br = json.loads(br)
        except Exception:
            br = {}
    if not isinstance(br, dict):
        br = {}
    sub: dict[str, Any] = {}
    if kind == "skills":
        sub = br.get("skills") if isinstance(br.get("skills"), dict) else {}
    elif kind == "combined":
        sub = br.get("job_ready") if isinstance(br.get("job_ready"), dict) else {}
        if not sub and isinstance(br.get("skills"), dict):
            sub = br["skills"]
    else:
        sub = br.get("job_ready") if isinstance(br.get("job_ready"), dict) else {}
        if not sub and isinstance(br.get("skills"), dict):
            sub = br["skills"]
    milestones = sub.get("milestones") if isinstance(sub, dict) else None
    if not isinstance(milestones, list):
        return (title, f"Continue {title} — one focused session today.")

    for m in milestones:
        if not isinstance(m, dict):
            continue
        st = str(m.get("status") or "").lower()
        if st == "in_progress":
            mt = str(m.get("title") or "This week")
            lob = m.get("learningObjective")
            extra = f" — {lob}" if isinstance(lob, str) and lob.strip() else ""
            return (title, f"{mt}{extra}")
    for m in milestones:
        if isinstance(m, dict):
            st = str(m.get("status") or "").lower()
            if st != "locked":
                return (title, str(m.get("title") or "Next milestone"))
    m0 = milestones[0] if milestones else {}
    if isinstance(m0, dict):
        return (title, str(m0.get("title") or "Start week 1"))
    return (title, "Open your roadmap for today's focus.")


def _parse_hhmm(s: str | None) -> tuple[int, int]:
    raw = (s or "18:00").strip()
    parts = raw.replace(".", ":").split(":")
    try:
        h = int(parts[0]) if parts else 18
        m = int(parts[1]) if len(parts) > 1 else 0
    except ValueError:
        return 18, 0
    return max(0, min(23, h)), max(0, min(59, m))


def _user_zone(tz_name: str | None) -> ZoneInfo:
    n = (tz_name or "UTC").strip() or "UTC"
    try:
        return ZoneInfo(n)
    except Exception:
        return ZoneInfo("UTC")


def _local_date_in_zone(iso_ts: str | None, zi: ZoneInfo) -> str | None:
    if not iso_ts:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_ts).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(zi).date().isoformat()
    except Exception:
        return None


def _is_past_digest_clock(now_local: datetime, digest_h: int, digest_m: int) -> bool:
    cur = now_local.hour * 60 + now_local.minute
    tgt = digest_h * 60 + digest_m
    return cur >= tgt


def try_send_scheduled_digest_for_user(
    *,
    settings: Any,
    supabase: Any,
    user_id: str,
    digest_hours: int = 24,
) -> dict[str, Any]:
    """
    Send daily learning digest (WhatsApp and/or voice) if:
    - User enabled at least one channel
    - Local wall time is past sparky_digest_local_time in sparky_digest_timezone
    - Not already sent for this local calendar day
    - Learning activity exists in the digest_hours window
    Primary trigger: dashboard session (no cron required). Optional batch cron may call this per user.
    """
    s = settings
    sid = getattr(s, "twilio_account_sid", None)
    token = getattr(s, "twilio_auth_token", None)
    wa_from = getattr(s, "twilio_whatsapp_from", None)
    voice_from = getattr(s, "twilio_voice_from", None)

    default_cc = (getattr(s, "phone_default_country_code", None) or "1").strip()
    since_iso, until_iso = _iso_range_last_hours(digest_hours)
    today_utc = _utc_today_str()

    try:
        pr = (
            supabase.table("profiles")
            .select(
                "id, phone, full_name, streak, xp, level, last_active_at, "
                "notify_whatsapp_digest, notify_voice_daily_learning, "
                "last_whatsapp_digest_at, last_voice_daily_digest_at, "
                "sparky_digest_local_time, sparky_digest_timezone"
            )
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = pr.data or []
    except Exception as e:
        logger.exception("digest profile %s", user_id)
        return {"ok": False, "status": "error", "detail": str(e)}

    if not rows:
        return {"ok": True, "status": "skipped", "reason": "profile_not_found"}

    p = rows[0]
    want_wa = bool(p.get("notify_whatsapp_digest", True))
    want_voice = bool(p.get("notify_voice_daily_learning"))
    if not want_wa and not want_voice:
        return {"ok": True, "status": "skipped", "reason": "digest_disabled"}

    zi = _user_zone(str(p.get("sparky_digest_timezone") or "UTC"))
    dh, dm = _parse_hhmm(str(p.get("sparky_digest_local_time") or "18:00"))
    now_local = datetime.now(zi)
    if not _is_past_digest_clock(now_local, dh, dm):
        return {"ok": True, "status": "skipped", "reason": "before_digest_time"}

    today_local = now_local.date().isoformat()
    last_at = p.get("last_whatsapp_digest_at")
    last_day = _local_date_in_zone(str(last_at) if last_at else None, zi)
    if last_day == today_local:
        return {"ok": True, "status": "skipped", "reason": "already_sent_today"}

    if not sid or not token or not str(sid).strip() or not str(token).strip():
        return {"ok": True, "status": "skipped", "reason": "twilio_not_configured"}

    if want_wa and (not wa_from or not str(wa_from).strip()):
        return {"ok": True, "status": "skipped", "reason": "twilio_whatsapp_not_configured"}

    if want_voice and (not voice_from or not str(voice_from).strip()):
        want_voice = False

    phone_raw = p.get("phone")
    to_e164 = normalize_phone_e164(phone_raw, default_cc=default_cc)
    if not to_e164:
        return {"ok": True, "status": "skipped", "reason": "no_phone"}

    snap = _collect_learning_snapshot(supabase, str(user_id), since_iso, until_iso)
    summary = _digest_text(snap)
    if not summary.strip():
        return {"ok": True, "status": "skipped", "reason": "no_learning_activity"}

    logged_in = _same_calendar_utc(
        p.get("last_active_at"), today_utc
    )
    rank, total = _xp_rank_and_total(supabase, int(p.get("xp") or 0))
    avg = _recent_quiz_avg(supabase, str(user_id))
    roadmap_title, focus = _todays_focus_from_roadmap(supabase, str(user_id))
    hint = infer_performance_hint(
        logged_in_today=logged_in,
        streak_days=int(p.get("streak") or 0),
        xp=int(p.get("xp") or 0),
        inactive_days=None,
        recent_avg=avg,
    )
    name = (p.get("full_name") or "there").split()[0]
    use_voice = bool(want_voice and voice_from and str(voice_from).strip())

    llm_kw = {
        "groq_api_key": getattr(s, "groq_api_key", None),
        "groq_model": getattr(s, "groq_model", "llama-3.3-70b-versatile"),
        "google_api_key": getattr(s, "google_api_key", None),
        "gemini_model": getattr(s, "gemini_model", "gemini-2.0-flash"),
    }

    channels: list[str] = []
    if want_wa:
        channels.append("whatsapp")
    if use_voice:
        channels.append("voice")

    state: dict[str, Any] = {
        "engagement_kind": "daily_learning_summary",
        "locale": "en",
        "user_name": name,
        "streak_days": int(p.get("streak") or 0),
        "xp": int(p.get("xp") or 0),
        "level": int(p.get("level") or 1),
        "logged_in_today": logged_in,
        "calendar_date_utc": today_utc,
        "digest_scheduled_local_time": f"{dh:02d}:{dm:02d}",
        "digest_timezone": str(p.get("sparky_digest_timezone") or "UTC"),
        "leaderboard_xp_rank": rank,
        "leaderboard_total_users": total,
        "roadmap_title": roadmap_title,
        "todays_focus_task": focus,
        "recent_avg_quiz_score_percent": round(avg, 1) if avg is not None else None,
        "performance_hint": hint,
        "cultural_banter_ok": hint == "absent_champion",
        "channels_requested": channels or ["whatsapp"],
        "learned_today_summary": summary,
    }

    try:
        composed = compose_engagement(**llm_kw, state=state)
        msg = str(composed.get("whatsapp_message") or "").strip()
        if want_wa and not msg:
            msg = (
                f"👋 Hey {name}!\n\n"
                "Here's your daily learning recap:\n\n"
                f"{summary}\n\n"
                "Great consistency! Keep the momentum going 🚀"
            )
        vscript = str(composed.get("voice_script") or "").strip()
        if use_voice and not vscript:
            # Remove emoji and format for TTS
            summary_tts = summary.replace("📚", "").replace("✅", "").replace("⭐", "").replace("⏱️", "").replace("🎯", "").replace("🚀", "").replace("👋", "")
            vscript = f"Hi {name}. Great work today! Here's your SkillCrew learning recap. {summary_tts[:700]}"

        dispatch_twilio(
            account_sid=str(sid).strip(),
            auth_token=str(token).strip(),
            whatsapp_from=str(wa_from).strip() if wa_from and want_wa else None,
            voice_from=str(voice_from).strip() if voice_from else None,
            sms_from=getattr(s, "twilio_sms_from", None),
            to_phone_e164=to_e164,
            whatsapp_message=msg[:1600] if want_wa else "",
            voice_script=vscript[:1200] if use_voice else "",
            use_whatsapp=want_wa,
            use_voice=use_voice,
            use_sms=False,
        )
        upd: dict[str, Any] = {
            "last_whatsapp_digest_at": datetime.now(timezone.utc).isoformat(),
        }
        if use_voice:
            upd["last_voice_daily_digest_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("profiles").update(upd).eq("id", user_id).execute()
        return {
            "ok": True,
            "status": "sent",
            "channels": [c for c in (["whatsapp"] if want_wa else []) + (["voice"] if use_voice else [])],
        }
    except Exception as e:
        logger.exception("digest user %s", user_id)
        return {"ok": False, "status": "error", "detail": str(e)}


def infer_performance_hint(
    *,
    logged_in_today: bool,
    streak_days: int,
    xp: int,
    inactive_days: int | None,
    recent_avg: float | None,
) -> str:
    if inactive_days is not None and inactive_days >= INACTIVITY_DAYS:
        return "long_absent"
    if streak_days >= CHAMPION_STREAK_MIN and xp >= CHAMPION_XP_MIN and not logged_in_today:
        return "absent_champion"
    if recent_avg is not None and recent_avg < 52 and not logged_in_today:
        return "demotivated_absent"
    if streak_days <= 1 and xp < 120 and not logged_in_today:
        return "demotivated_absent"
    if not logged_in_today and streak_days > 0:
        return "streak_at_risk"
    return "steady_learner"


def run_daily_whatsapp_digest(
    *,
    settings: Any,
    supabase: Any,
    digest_hours: int = 24,
) -> dict[str, Any]:
    """Optional batch job: same rules as dashboard-triggered digest (per-user local time + activity)."""
    s = settings
    sid = getattr(s, "twilio_account_sid", None)
    token = getattr(s, "twilio_auth_token", None)
    if not sid or not token or not str(sid).strip() or not str(token).strip():
        raise RuntimeError("Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)")

    try:
        res = (
            supabase.table("profiles")
            .select("id")
            .or_("notify_whatsapp_digest.eq.true,notify_voice_daily_learning.eq.true")
            .execute()
        )
        ids = [str(r["id"]) for r in (res.data or [])]
    except Exception as e:
        logger.exception("profiles list digest batch")
        raise RuntimeError(str(e)) from e

    since_iso, until_iso = _iso_range_last_hours(digest_hours)
    sent = 0
    skipped = 0
    errors: list[dict[str, str]] = []

    for uid in ids:
        out = try_send_scheduled_digest_for_user(
            settings=s,
            supabase=supabase,
            user_id=uid,
            digest_hours=digest_hours,
        )
        if out.get("status") == "sent":
            sent += 1
        elif out.get("ok") and out.get("status") == "skipped":
            skipped += 1
        elif not out.get("ok"):
            errors.append({"user_id": uid, "error": str(out.get("detail") or "unknown")})

    return {
        "ok": True,
        "window_hours": digest_hours,
        "since": since_iso,
        "until": until_iso,
        "sent": sent,
        "skipped": skipped,
        "errors": errors,
        "note": "Per-user sparky_digest_local_time / timezone; no global cron required if users open the app.",
    }


def run_inactivity_voice_calls(
    *,
    settings: Any,
    supabase: Any,
    inactive_days: int = INACTIVITY_DAYS,
) -> dict[str, Any]:
    """Voice + optional WhatsApp for users inactive >= `inactive_days` (by last_active_at)."""
    s = settings
    sid = getattr(s, "twilio_account_sid", None)
    token = getattr(s, "twilio_auth_token", None)
    voice_from = getattr(s, "twilio_voice_from", None)
    wa_from = getattr(s, "twilio_whatsapp_from", None)
    if not sid or not token or not str(sid).strip() or not str(token).strip():
        raise RuntimeError("Twilio not configured")
    if not voice_from or not str(voice_from).strip():
        raise RuntimeError("TWILIO_VOICE_FROM is not set (E.164 voice-capable number)")

    default_cc = (getattr(s, "phone_default_country_code", None) or "1").strip()
    cutoff = datetime.now(timezone.utc) - timedelta(days=inactive_days)
    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(days=INACTIVITY_CALL_COOLDOWN_DAYS)
    today = _utc_today_str()

    try:
        res = supabase.table("profiles").select(
            "id, phone, full_name, streak, xp, last_active_at, "
            "notify_voice_reengagement, notify_whatsapp_inactivity, last_inactivity_call_at"
        ).eq("notify_voice_reengagement", True).execute()
        profiles = res.data or []
    except Exception as e:
        logger.exception("profiles list inactivity")
        raise RuntimeError(str(e)) from e

    sent = 0
    skipped = 0
    errors: list[dict[str, str]] = []

    llm_kw = {
        "groq_api_key": getattr(s, "groq_api_key", None),
        "groq_model": getattr(s, "groq_model", "llama-3.3-70b-versatile"),
        "google_api_key": getattr(s, "google_api_key", None),
        "gemini_model": getattr(s, "gemini_model", "gemini-2.0-flash"),
    }

    for p in profiles:
        uid = p.get("id")
        to_e164 = normalize_phone_e164(p.get("phone"), default_cc=default_cc)
        if not to_e164:
            skipped += 1
            continue

        la = p.get("last_active_at")
        if not la:
            skipped += 1
            continue
        try:
            lat = datetime.fromisoformat(str(la).replace("Z", "+00:00"))
            if lat.tzinfo is None:
                lat = lat.replace(tzinfo=timezone.utc)
        except Exception:
            skipped += 1
            continue

        if lat > cutoff:
            skipped += 1
            continue

        lic = p.get("last_inactivity_call_at")
        if lic:
            try:
                lt = datetime.fromisoformat(str(lic).replace("Z", "+00:00"))
                if lt.tzinfo is None:
                    lt = lt.replace(tzinfo=timezone.utc)
                if lt > cooldown_cutoff:
                    skipped += 1
                    continue
            except Exception:
                pass

        inactive_days_computed = max(
            inactive_days,
            int((datetime.now(timezone.utc) - lat).total_seconds() // 86400),
        )

        logged_in = _same_calendar_utc(lat.isoformat(), today)
        rank, total = _xp_rank_and_total(supabase, int(p.get("xp") or 0))
        avg = _recent_quiz_avg(supabase, str(uid))
        roadmap_title, focus = _todays_focus_from_roadmap(supabase, str(uid))
        hint = infer_performance_hint(
            logged_in_today=logged_in,
            streak_days=int(p.get("streak") or 0),
            xp=int(p.get("xp") or 0),
            inactive_days=inactive_days_computed,
            recent_avg=avg,
        )

        name = (p.get("full_name") or "there").split()[0]
        wa_ok = bool(p.get("notify_whatsapp_inactivity", True)) and wa_from and str(wa_from).strip()

        state: dict[str, Any] = {
            "engagement_kind": "inactivity_reengagement",
            "locale": "en",
            "user_name": name,
            "inactive_days": inactive_days_computed,
            "streak_days": int(p.get("streak") or 0),
            "xp": int(p.get("xp") or 0),
            "logged_in_today": logged_in,
            "calendar_date_utc": today,
            "leaderboard_xp_rank": rank,
            "leaderboard_total_users": total,
            "roadmap_title": roadmap_title,
            "todays_focus_task": focus,
            "recent_avg_quiz_score_percent": round(avg, 1) if avg is not None else None,
            "performance_hint": "long_absent" if inactive_days_computed >= inactive_days else hint,
            "cultural_banter_ok": hint == "absent_champion",
            "channels_requested": ["voice", "whatsapp"] if wa_ok else ["voice"],
            "learned_today_summary": "",
        }
        try:
            composed = compose_engagement(**llm_kw, state=state)
            script = str(composed.get("voice_script") or "").strip()
            if not script:
                script = (
                    f"Hi {name}, this is SkillCrew. We have not seen you in a few days. "
                    f"Open the app when you can — even ten minutes helps. You've got this."
                )
            wa_msg = str(composed.get("whatsapp_message") or "").strip()
            if wa_ok and not wa_msg:
                wa_msg = (
                    f"Hi {name} — SkillCrew here. Miss you! Tap in for a few minutes; "
                    f"your streak is {int(p.get('streak') or 0)} days. {focus[:200]}"
                )

            dispatch_twilio(
                account_sid=str(sid).strip(),
                auth_token=str(token).strip(),
                whatsapp_from=str(wa_from).strip() if wa_from else None,
                voice_from=str(voice_from).strip(),
                sms_from=getattr(s, "twilio_sms_from", None),
                to_phone_e164=to_e164,
                whatsapp_message=wa_msg[:1600] if wa_ok else "",
                voice_script=script[:1200],
                use_whatsapp=wa_ok,
                use_voice=True,
                use_sms=False,
            )
            supabase.table("profiles").update(
                {"last_inactivity_call_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", uid).execute()
            sent += 1
        except Exception as e:
            logger.exception("inactivity call user %s", uid)
            errors.append({"user_id": str(uid), "error": str(e)})

    return {
        "ok": True,
        "inactive_days_threshold": inactive_days,
        "sent": sent,
        "skipped": skipped,
        "errors": errors,
    }


def run_streak_risk_reminders(
    *,
    settings: Any,
    supabase: Any,
) -> dict[str, Any]:
    """Email + WhatsApp nudges to protect today's streak (UTC) before the day is lost."""
    s = settings
    resend_key = (getattr(s, "resend_api_key", None) or "").strip()
    from_email = (getattr(s, "resend_from_email", None) or "onboarding@resend.dev").strip()

    sid = getattr(s, "twilio_account_sid", None)
    token = getattr(s, "twilio_auth_token", None)
    wa_from = getattr(s, "twilio_whatsapp_from", None)

    default_cc = (getattr(s, "phone_default_country_code", None) or "1").strip()
    today = _utc_today_str()

    try:
        prefs_res = (
            supabase.table("user_preferences")
            .select("user_id, streak_alerts, email_notifications")
            .eq("streak_alerts", True)
            .execute()
        )
        pref_rows = {str(r["user_id"]): r for r in (prefs_res.data or [])}
    except Exception as e:
        logger.exception("user_preferences streak")
        raise RuntimeError(str(e)) from e

    try:
        pr = (
            supabase.table("profiles")
            .select(
                "id, email, phone, full_name, streak, xp, level, last_active_at, "
                "notify_email_streak_reminders, notify_whatsapp_streak, "
                "last_streak_reminder_email_at, last_streak_reminder_whatsapp_at"
            )
            .gt("streak", 0)
            .execute()
        )
        profiles = pr.data or []
    except Exception as e:
        logger.exception("profiles streak")
        raise RuntimeError(str(e)) from e

    email_sent = 0
    wa_sent = 0
    skipped_no_prefs = 0
    skipped_already_active = 0
    skipped_nothing_to_send = 0
    errors: list[dict[str, str]] = []

    llm_kw = {
        "groq_api_key": getattr(s, "groq_api_key", None),
        "groq_model": getattr(s, "groq_model", "llama-3.3-70b-versatile"),
        "google_api_key": getattr(s, "google_api_key", None),
        "gemini_model": getattr(s, "gemini_model", "gemini-2.0-flash"),
    }

    for p in profiles:
        uid = str(p.get("id"))
        if uid not in pref_rows:
            skipped_no_prefs += 1
            continue

        prefs = pref_rows[uid]

        if _same_calendar_utc(p.get("last_active_at"), today):
            skipped_already_active += 1
            continue

        rank, total = _xp_rank_and_total(supabase, int(p.get("xp") or 0))
        avg = _recent_quiz_avg(supabase, uid)
        roadmap_title, focus = _todays_focus_from_roadmap(supabase, uid)
        hint = infer_performance_hint(
            logged_in_today=False,
            streak_days=int(p.get("streak") or 0),
            xp=int(p.get("xp") or 0),
            inactive_days=None,
            recent_avg=avg,
        )
        name = (p.get("full_name") or "there").split()[0]

        state_base: dict[str, Any] = {
            "engagement_kind": "streak_at_risk",
            "locale": "en",
            "user_name": name,
            "streak_days": int(p.get("streak") or 0),
            "xp": int(p.get("xp") or 0),
            "level": int(p.get("level") or 1),
            "logged_in_today": False,
            "calendar_date_utc": today,
            "leaderboard_xp_rank": rank,
            "leaderboard_total_users": total,
            "roadmap_title": roadmap_title,
            "todays_focus_task": focus,
            "recent_avg_quiz_score_percent": round(avg, 1) if avg is not None else None,
            "performance_hint": hint if hint != "steady_learner" else "streak_at_risk",
            "cultural_banter_ok": hint == "absent_champion",
        }

        sent_something = False

        want_email = (
            bool(p.get("notify_email_streak_reminders", True))
            and bool(prefs.get("email_notifications"))
            and bool(resend_key)
        )
        em = (p.get("email") or "").strip()
        last_em = p.get("last_streak_reminder_email_at")
        if want_email and em and "@" in em:
            if last_em and _same_calendar_utc(str(last_em), today):
                want_email = False
        else:
            want_email = False

        if want_email:
            try:
                st = {**state_base, "channels_requested": ["email"]}
                composed = compose_engagement(**llm_kw, state=st)
                subj = str(composed.get("email_subject") or "").strip() or (
                    f"{name}, your {int(p.get('streak') or 0)}‑day streak needs you today"
                )
                body = str(composed.get("email_body_text") or "").strip()
                if not body:
                    body = (
                        f"Hi {name},\n\n"
                        f"You are on a {int(p.get('streak') or 0)}‑day streak. Complete today's focus before midnight UTC: "
                        f"{focus}\n\n"
                        f"Leaderboard (XP): about #{rank} of {total} learners.\n\n"
                        f"— SkillCrew / Sparky"
                    )
                dispatch_resend_plain_email(
                    resend_api_key=resend_key,
                    from_email=from_email,
                    to_email=em,
                    subject=subj[:200],
                    body_text=body[:100000],
                )
                supabase.table("profiles").update(
                    {"last_streak_reminder_email_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", uid).execute()
                email_sent += 1
                sent_something = True
            except Exception as e:
                logger.exception("streak email %s", uid)
                errors.append({"user_id": uid, "error": str(e)})

        want_wa = bool(p.get("notify_whatsapp_streak", True))
        to_e164 = normalize_phone_e164(p.get("phone"), default_cc=default_cc)
        last_wa = p.get("last_streak_reminder_whatsapp_at")
        if want_wa and to_e164 and sid and token and wa_from and str(wa_from).strip():
            if last_wa and _same_calendar_utc(str(last_wa), today):
                want_wa = False
        else:
            want_wa = False

        if want_wa:
            try:
                st = {**state_base, "channels_requested": ["whatsapp"]}
                composed = compose_engagement(**llm_kw, state=st)
                msg = str(composed.get("whatsapp_message") or "").strip()
                if not msg:
                    msg = (
                        f"Hi {name}! Streak {int(p.get('streak') or 0)} days — log in today. "
                        f"Today: {focus[:400]}. Rank ~#{rank}/{total} on XP."
                    )
                dispatch_twilio(
                    account_sid=str(sid).strip(),
                    auth_token=str(token).strip(),
                    whatsapp_from=str(wa_from).strip(),
                    voice_from=getattr(s, "twilio_voice_from", None),
                    sms_from=getattr(s, "twilio_sms_from", None),
                    to_phone_e164=to_e164,
                    whatsapp_message=msg[:1600],
                    voice_script="",
                    use_whatsapp=True,
                    use_voice=False,
                    use_sms=False,
                )
                supabase.table("profiles").update(
                    {"last_streak_reminder_whatsapp_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", uid).execute()
                wa_sent += 1
                sent_something = True
            except Exception as e:
                logger.exception("streak wa %s", uid)
                errors.append({"user_id": uid, "error": str(e)})

        if not sent_something:
            skipped_nothing_to_send += 1

    return {
        "ok": True,
        "date_utc": today,
        "email_sent": email_sent,
        "whatsapp_sent": wa_sent,
        "skipped_no_streak_alerts_prefs": skipped_no_prefs,
        "skipped_already_logged_in_today_utc": skipped_already_active,
        "skipped_no_channel_or_deduped": skipped_nothing_to_send,
        "errors": errors,
    }
