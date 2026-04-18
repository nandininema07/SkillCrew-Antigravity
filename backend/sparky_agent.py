"""Sparky: engagement copy + optional Twilio dispatch (Gemini composes all user-facing text)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from llm_client import llm_generate_json

logger = logging.getLogger(__name__)


def compose_engagement(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    state: dict[str, Any],
) -> dict[str, Any]:
    """
    state may include:
      engagement_kind: daily_learning_summary | streak_at_risk | inactivity_reengagement |
        login_welcome | pip_checkpoint_whatsapp | milestone_modules_progress
      locale, user_name, streak_days, inactive_days, xp, level,
      logged_in_today (bool), calendar_date_utc (YYYY-MM-DD),
      leaderboard_xp_rank, leaderboard_total_users,
      todays_focus_task, roadmap_title,
      recent_avg_quiz_score_percent (optional),
      performance_hint:
        steady_learner | demotivated_absent | absent_champion | streak_at_risk | long_absent
      channels_requested: ["whatsapp","email","voice"],
      learned_today_summary (bullets / digest text),
      cultural_banter_ok (bool) — playful teasing in locale when absent_champion
    """
    system = (
        "You are Sparky, a motivational learning companion for SkillCrew. You write alerts, summaries, "
        "and scripts for WhatsApp, email, and voice calls. Adapt to ANY learner — not only tech workers.\n"
        "Rules:\n"
        "- Match `engagement_kind` and `performance_hint`:\n"
        "  * demotivated_absent — warm, gentle, small-steps encouragement; no guilt.\n"
        "  * absent_champion — user is strong on XP/streak but missed today: playful, affectionate banter "
        "in their language/locale (tease like a friend), still respectful and safe. "
        "If cultural_banter_ok is true, you may use light cultural humor; never slurs or harassment.\n"
        "  * streak_at_risk — urgency to protect the streak today; clear CTA.\n"
        "  * long_absent (3+ days) — voice should sound like a caring human check-in; WhatsApp shorter.\n"
        "  * steady_learner — celebrate consistency for daily_learning_summary; **prominently feature learned_today_summary**.\n"
        "  * daily_learning_summary — **must include learned_today_summary as a core floating summary**; celebrate what they accomplished.\n"
        "  * login_welcome — short warm welcome back after opening the app; mention streak/xp/level if present; no guilt; under ~600 chars for WhatsApp.\n"
        "  * pip_checkpoint_whatsapp — celebrate Pip weekly quiz result; include score_percent, week, milestone_id, roadmap_title; concise.\n"
        "  * milestone_modules_progress — celebrate a newly completed roadmap node; include nodes_completed, nodes_total, percent, milestone_title; no quiz score unless provided.\n"
        "- Include concrete facts from state when present: today's focus task, streak_days, "
        "leaderboard_xp_rank / leaderboard_total_users, **learned_today_summary (especially for daily_learning_summary engagement_kind)**.\n"
        "- For daily_learning_summary: opening should praise/celebrate, then float the learned_today_summary items, then close with motivational momentum.\n"
        "- Voice scripts: plain language, TTS-friendly; no emoji; avoid $ & < > and excessive punctuation.\n"
        "- WhatsApp: concise; can use one or two line breaks; include learned_today_summary if present.\n"
        "- Email: subject engaging; body plain text, short paragraphs; include learned_today_summary prominently.\n"
        "Output JSON only."
    )
    prompt = (
        "User / cohort state (JSON):\n"
        + json.dumps(state, ensure_ascii=False, indent=2)
        + "\n\nReturn JSON:\n"
        "{\n"
        '  "whatsapp_message": string (<= 900 chars; can include line breaks),\n'
        '  "email_subject": string,\n'
        '  "email_body_text": string (plain; friendly paragraphs),\n'
        '  "voice_script": string (short; suitable for phone TTS; avoid special symbols),\n'
        '  "sparky_reasoning": string (brief: tone + why)\n'
        "}\n"
        "If a channel is not in channels_requested, still fill it with empty string."
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.85,
    )


def dispatch_twilio(
    *,
    account_sid: str,
    auth_token: str,
    whatsapp_from: str | None,
    voice_from: str | None,
    sms_from: str | None,
    to_phone_e164: str,
    whatsapp_message: str = "",
    voice_script: str = "",
    use_whatsapp: bool = False,
    use_voice: bool = False,
    use_sms: bool = False,
) -> dict[str, Any]:
    try:
        from twilio.rest import Client
    except ImportError as e:
        raise RuntimeError("twilio package not installed") from e

    client = Client(account_sid, auth_token)
    results: dict[str, Any] = {}

    def _twiml_escape(s: str) -> str:
        return (
            s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )

    if use_voice and voice_from and voice_script.strip():
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">{_twiml_escape(voice_script[:1200])}</Say></Response>'
        call = client.calls.create(to=to_phone_e164, from_=voice_from, twiml=twiml)
        results["call_sid"] = call.sid

    if use_whatsapp and whatsapp_from and whatsapp_message.strip():
        msg = client.messages.create(
            from_=whatsapp_from,
            to=f"whatsapp:{to_phone_e164}" if not to_phone_e164.startswith("whatsapp:") else to_phone_e164,
            body=whatsapp_message[:1600],
        )
        results["whatsapp_sid"] = msg.sid

    if use_sms and sms_from and whatsapp_message.strip():
        msg = client.messages.create(from_=sms_from, to=to_phone_e164, body=whatsapp_message[:1600])
        results["sms_sid"] = msg.sid

    return results


def dispatch_sendgrid_email(
    *,
    sendgrid_api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    body_text: str,
) -> dict[str, Any]:
    url = "https://api.sendgrid.com/v3/mail/send"
    payload = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email},
        "subject": subject[:998],
        "content": [{"type": "text/plain", "value": body_text[:100000]}],
    }
    with httpx.Client(timeout=30.0) as h:
        r = h.post(url, json=payload, headers={"Authorization": f"Bearer {sendgrid_api_key}"})
    if r.status_code >= 300:
        logger.warning("SendGrid error %s: %s", r.status_code, r.text[:500])
        raise RuntimeError(f"SendGrid failed: {r.status_code}")
    return {"status": r.status_code}


def dispatch_resend_plain_email(
    *,
    resend_api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    body_text: str,
) -> dict[str, Any]:
    """Plain-text email via Resend (same transport as Pip checkpoint summaries)."""
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject.strip()[:200] or "SkillCrew",
        "text": body_text[:100000],
    }
    with httpx.Client(timeout=45.0) as client:
        r = client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key.strip()}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code >= 400:
        logger.warning("Resend error %s: %s", r.status_code, r.text[:500])
        raise RuntimeError(f"Resend failed: {r.status_code} {r.text[:400]}")
    return {"ok": True, "resend": r.json() if r.content else {}}
