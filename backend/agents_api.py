"""Internal HTTP API for Archie, Dexter, Pip, Sparky, Coach — secured with X-Agent-Secret."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client

from archie_agent import build_certifications_bundle, build_roadmap_bundle, revise_roadmap_bundle
from archie_tavily_enrich import enrich_archie_bundle_with_tavily
from coach_agent import coach_turn
from dexter_agent import fetch_resources_auto
from pip_agent import (
    build_checkpoint_assessment,
    build_quiz,
    build_revision_pack,
    grade_checkpoint_assessment,
    grade_quiz,
)
from sparky_agent import compose_engagement, dispatch_sendgrid_email, dispatch_twilio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/agents", tags=["agents"])

_settings: Any = None
_cached_agent_secret: str = ""


def init_agents(settings: Any) -> None:
    global _settings, _cached_agent_secret
    _settings = settings
    _cached_agent_secret = (
        (getattr(settings, "backend_agent_secret", None) or "").strip()
        or (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    )
    if not _cached_agent_secret:
        env_path = Path(__file__).resolve().parent / ".env"
        load_dotenv(env_path, override=True)
        _cached_agent_secret = (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()


def _s() -> Any:
    if _settings is None:
        raise RuntimeError("agents not initialized")
    return _settings


def _resolved_agent_secret() -> str:
    """Prefer cached value from init_agents; then settings; then OS env (handles reload quirks)."""
    global _cached_agent_secret
    if _cached_agent_secret:
        return _cached_agent_secret
    s = _s()
    from_settings = (getattr(s, "backend_agent_secret", None) or "").strip()
    if from_settings:
        _cached_agent_secret = from_settings
        return from_settings
    env_secret = (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    if env_secret:
        _cached_agent_secret = env_secret
        return env_secret
    load_dotenv(Path(__file__).resolve().parent / ".env", override=True)
    env_secret = (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    if env_secret:
        _cached_agent_secret = env_secret
    return env_secret


def verify_agent_secret(x_agent_secret: str | None = Header(default=None, alias="X-Agent-Secret")) -> None:
    expected = _resolved_agent_secret()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail=(
                "BACKEND_AGENT_SECRET is not configured on the API server. "
                "Add it to backend/.env, restart uvicorn, and ensure it matches Next.js BACKEND_AGENT_SECRET."
            ),
        )
    if (x_agent_secret or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _llm_kw() -> dict[str, Any]:
    s = _s()
    return {
        "groq_api_key": getattr(s, "groq_api_key", None),
        "groq_model": getattr(s, "groq_model", "llama-3.3-70b-versatile"),
        "google_api_key": getattr(s, "google_api_key", None),
        "gemini_model": getattr(s, "gemini_model", "gemini-2.0-flash"),
    }


def _service_supabase() -> Any:
    """Service-role Supabase client for engagement jobs (same credentials as main API)."""
    s = _s()
    url = (
        (getattr(s, "supabase_project_url", None) or "").strip()
        or (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
    )
    key = (getattr(s, "supabase_service_role_key", None) or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail="SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are required for engagement digest.",
        )
    return create_client(url, key)


def _milestone_week_count(bundle: dict[str, Any]) -> int:
    m = bundle.get("milestones")
    if not isinstance(m, list):
        return 0
    return len(m)


MIN_ROADMAP_WEEKS = 8


class RoadmapBody(BaseModel):
    context: dict[str, Any]


class ReviseBody(BaseModel):
    current_bundle: dict[str, Any]
    adaptation_signals: dict[str, Any] = Field(default_factory=dict)
    learner_context: dict[str, Any]


class CertBody(BaseModel):
    context: dict[str, Any]


class DexterBody(BaseModel):
    modules: list[dict[str, Any]]
    max_results_per_module: int = 8


class PipQuizBody(BaseModel):
    topics_learned: list[str]
    difficulty: str = "intermediate"
    count: int = 5
    locale: str | None = None


class PipGradeBody(BaseModel):
    quiz: dict[str, Any]
    answers: dict[str, int]


class PipRevisionBody(BaseModel):
    topics: list[str]
    notes: str | None = None
    locale: str | None = None


class PipCheckpointBuildBody(BaseModel):
    topics_covered: list[str]
    preferences: dict[str, Any] = Field(default_factory=dict)
    locale: str | None = None
    question_count: int = 6
    roadmap_direction: str | None = None
    track_title: str | None = None
    roadmap_mode: str | None = None


class PipCheckpointGradeBody(BaseModel):
    assessment: dict[str, Any]
    answers: dict[str, Any]


class PipCheckpointEmailBody(BaseModel):
    to_email: str
    subject: str = "Your Pip quiz results"
    html: str


class SparkyComposeBody(BaseModel):
    state: dict[str, Any]


class SparkyDispatchBody(BaseModel):
    to_phone_e164: str
    to_email: str | None = None
    compose_state: dict[str, Any]
    use_whatsapp: bool = False
    use_voice: bool = False
    use_sms: bool = False
    use_email: bool = False


class DigestIfDueBody(BaseModel):
    user_id: str = Field(..., min_length=1)


class CoachBody(BaseModel):
    payload: dict[str, Any]


@router.post("/archie/roadmap", dependencies=[Depends(verify_agent_secret)])
def archie_roadmap(body: RoadmapBody) -> dict[str, Any]:
    try:
        bundle = build_roadmap_bundle(**_llm_kw(), context=body.context)
        n = _milestone_week_count(bundle)
        micro = False
        ctx = body.context
        if isinstance(ctx, dict):
            prefs = ctx.get("preferences")
            if isinstance(prefs, dict) and str(prefs.get("learning_pace", "")).lower() in (
                "micro",
                "1-week",
                "one_week",
                "crash",
            ):
                micro = True
            if ctx.get("explicit_micro_course") is True:
                micro = True
        if not micro and n < MIN_ROADMAP_WEEKS:
            ctx2 = dict(body.context)
            ctx2["_minimum_weeks_remediation"] = (
                f"The previous draft had only {n} weekly milestone(s). Regenerate the COMPLETE JSON roadmap with "
                f"at least {MIN_ROADMAP_WEEKS} weekly milestones (week-1 … week-{MIN_ROADMAP_WEEKS}), "
                "one module per week, each with five+ lessons; weeklyTimeline.totalWeeks must match."
            )
            bundle = build_roadmap_bundle(**_llm_kw(), context=ctx2)
        tavily = getattr(_s(), "tavily_api_key", None)
        return enrich_archie_bundle_with_tavily(bundle, tavily)
    except Exception as e:
        logger.exception("archie roadmap")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/archie/revise", dependencies=[Depends(verify_agent_secret)])
def archie_revise(body: ReviseBody) -> dict[str, Any]:
    try:
        bundle = revise_roadmap_bundle(
            **_llm_kw(),
            current_bundle=body.current_bundle,
            adaptation_signals=body.adaptation_signals,
            learner_context=body.learner_context,
        )
        tavily = getattr(_s(), "tavily_api_key", None)
        return enrich_archie_bundle_with_tavily(bundle, tavily)
    except Exception as e:
        logger.exception("archie revise")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/archie/certifications", dependencies=[Depends(verify_agent_secret)])
def archie_certs(body: CertBody) -> dict[str, Any]:
    try:
        return build_certifications_bundle(**_llm_kw(), context=body.context)
    except Exception as e:
        logger.exception("archie certs")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/dexter/resources", dependencies=[Depends(verify_agent_secret)])
def dexter_resources(body: DexterBody) -> dict[str, Any]:
    s = _s()
    try:
        return fetch_resources_auto(
            tavily_api_key=getattr(s, "tavily_api_key", None),
            apify_api_token=getattr(s, "apify_api_token", None),
            apify_google_actor=getattr(s, "apify_google_search_actor", "apify/google-search-scraper"),
            modules=body.modules,
            max_results_per_module=body.max_results_per_module,
        )
    except Exception as e:
        logger.exception("dexter")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/pip/quiz", dependencies=[Depends(verify_agent_secret)])
def pip_quiz(body: PipQuizBody) -> dict[str, Any]:
    try:
        return build_quiz(
            **_llm_kw(),
            topics_learned=body.topics_learned,
            difficulty=body.difficulty,
            count=body.count,
            locale=body.locale,
        )
    except Exception as e:
        logger.exception("pip quiz")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/pip/grade", dependencies=[Depends(verify_agent_secret)])
def pip_grade(body: PipGradeBody) -> dict[str, Any]:
    try:
        return grade_quiz(**_llm_kw(), quiz=body.quiz, answers=body.answers)
    except Exception as e:
        logger.exception("pip grade")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/pip/revision-pack", dependencies=[Depends(verify_agent_secret)])
def pip_revision(body: PipRevisionBody) -> dict[str, Any]:
    try:
        return build_revision_pack(
            **_llm_kw(),
            topics=body.topics,
            notes=body.notes,
            locale=body.locale,
        )
    except Exception as e:
        logger.exception("pip revision")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/pip/checkpoint/build", dependencies=[Depends(verify_agent_secret)])
def pip_checkpoint_build(body: PipCheckpointBuildBody) -> dict[str, Any]:
    try:
        return build_checkpoint_assessment(
            **_llm_kw(),
            topics_covered=body.topics_covered,
            preferences=body.preferences,
            locale=body.locale,
            question_count=body.question_count,
            roadmap_direction=body.roadmap_direction,
            track_title=body.track_title,
            roadmap_mode=body.roadmap_mode,
        )
    except Exception as e:
        logger.exception("pip checkpoint build")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/pip/checkpoint/grade", dependencies=[Depends(verify_agent_secret)])
def pip_checkpoint_grade(body: PipCheckpointGradeBody) -> dict[str, Any]:
    try:
        return grade_checkpoint_assessment(
            **_llm_kw(),
            assessment=body.assessment,
            answers=body.answers,
        )
    except Exception as e:
        logger.exception("pip checkpoint grade")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/email/pip-checkpoint-summary", dependencies=[Depends(verify_agent_secret)])
def pip_checkpoint_email(body: PipCheckpointEmailBody) -> dict[str, Any]:
    """Send HTML summary email via Resend (RESEND_API_KEY in backend/.env)."""
    s = _s()
    key = (getattr(s, "resend_api_key", None) or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="RESEND_API_KEY is not configured on the API server (backend/.env).",
        )
    from_email = (getattr(s, "resend_from_email", None) or "onboarding@resend.dev").strip()
    to_email = body.to_email.strip()
    if not to_email or "@" not in to_email:
        raise HTTPException(status_code=400, detail="Invalid to_email")

    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": body.subject.strip()[:200] or "Your Pip quiz results",
        "html": body.html,
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            r = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if r.status_code >= 400:
            logger.warning("Resend error %s: %s", r.status_code, r.text[:500])
            raise HTTPException(status_code=502, detail=f"Resend error: {r.text[:400]}")
        data = r.json()
        return {"success": True, "resend": data}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("pip checkpoint email")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/sparky/compose", dependencies=[Depends(verify_agent_secret)])
def sparky_compose(body: SparkyComposeBody) -> dict[str, Any]:
    try:
        return compose_engagement(**_llm_kw(), state=body.state)
    except Exception as e:
        logger.exception("sparky compose")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/sparky/dispatch", dependencies=[Depends(verify_agent_secret)])
def sparky_dispatch(body: SparkyDispatchBody) -> dict[str, Any]:
    s = _s()
    out: dict[str, Any] = {}
    try:
        composed = compose_engagement(**_llm_kw(), state=body.compose_state)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    sid = getattr(s, "twilio_account_sid", None)
    token = getattr(s, "twilio_auth_token", None)
    if body.use_voice or body.use_whatsapp or body.use_sms:
        if not sid or not token:
            raise HTTPException(status_code=503, detail="Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)")
        out["twilio"] = dispatch_twilio(
            account_sid=sid.strip(),
            auth_token=token.strip(),
            whatsapp_from=getattr(s, "twilio_whatsapp_from", None),
            voice_from=getattr(s, "twilio_voice_from", None),
            sms_from=getattr(s, "twilio_sms_from", None),
            to_phone_e164=body.to_phone_e164.strip(),
            whatsapp_message=str(composed.get("whatsapp_message") or ""),
            voice_script=str(composed.get("voice_script") or ""),
            use_whatsapp=body.use_whatsapp,
            use_voice=body.use_voice,
            use_sms=body.use_sms,
        )

    if body.use_email and body.to_email:
        sg = getattr(s, "sendgrid_api_key", None)
        from_em = getattr(s, "sendgrid_from_email", None)
        if not sg or not from_em:
            raise HTTPException(status_code=503, detail="SendGrid not configured (SENDGRID_API_KEY, SENDGRID_FROM_EMAIL)")
        out["email"] = dispatch_sendgrid_email(
            sendgrid_api_key=sg.strip(),
            from_email=from_em.strip(),
            to_email=body.to_email.strip(),
            subject=str(composed.get("email_subject") or "SkillCrew"),
            body_text=str(composed.get("email_body_text") or ""),
        )

    out["composed"] = composed
    return out


@router.post("/engagement/digest-if-due", dependencies=[Depends(verify_agent_secret)])
def engagement_digest_if_due(body: DigestIfDueBody) -> dict[str, Any]:
    """Called from Next.js when a user opens the dashboard — sends digest if local time + activity allow."""
    from engagement_cron import try_send_scheduled_digest_for_user

    try:
        supabase = _service_supabase()
        return try_send_scheduled_digest_for_user(
            settings=_s(),
            supabase=supabase,
            user_id=body.user_id.strip(),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("engagement digest-if-due")
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/coach", dependencies=[Depends(verify_agent_secret)])
def coach(body: CoachBody) -> dict[str, Any]:
    try:
        return coach_turn(**_llm_kw(), payload=body.payload)
    except Exception as e:
        logger.exception("coach")
        raise HTTPException(status_code=502, detail=str(e)) from e
