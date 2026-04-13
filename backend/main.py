"""FastAPI onboarding API: LinkedIn (Apify Actor, Firecrawl fallback) + resume (Gemini) → Supabase."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parent / ".env"
REPO_ENV = Path(__file__).resolve().parent.parent / ".env"
if REPO_ENV.is_file():
    load_dotenv(REPO_ENV, override=False)
load_dotenv(ROOT_ENV, override=True)

import anyio
import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AliasChoices, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

from agents_api import init_agents, router as agents_router
from assessments_api import init_assessment_services, router as assessments_router
from integrations import parse_resume_pdf, try_scrape_linkedin_profile
from nova_agent import build_extracted_skills, merge_profiles
from learning_continuity import LearningContinuityService
from context_aware_agent import ContextAwareNovaAgent
from pdf_parser import extract_text_from_pdf_bytes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_project_url: str = Field(
        validation_alias=AliasChoices(
            "SUPABASE_PROJECT_URL",
            "SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
        ),
    )
    supabase_service_role_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY"),
    )
    # Optional if you only use Apify for LinkedIn; Firecrawl fallback needs this.
    firecrawl_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("FIRECRAWL_API_KEY"),
    )
    google_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    )
    gemini_model: str = Field(
        default="gemini-2.0-flash",
        validation_alias=AliasChoices("GEMINI_MODEL"),
    )
    groq_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GROQ_API_KEY"),
    )
    groq_model: str = Field(
        default="llama-3.3-70b-versatile",
        validation_alias=AliasChoices("GROQ_MODEL"),
    )
    tavily_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TAVILY_API_KEY"),
    )
    backend_agent_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("BACKEND_AGENT_SECRET"),
    )
    cron_secret: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CRON_SECRET"),
    )
    apify_api_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("APIFY_API_TOKEN", "APIFY_TOKEN"),
    )
    apify_linkedin_actor: str = Field(
        default="harvestapi/linkedin-profile-scraper",
        validation_alias=AliasChoices("APIFY_LINKEDIN_ACTOR"),
    )
    apify_google_search_actor: str = Field(
        default="apify/google-search-scraper",
        validation_alias=AliasChoices("APIFY_GOOGLE_SEARCH_ACTOR"),
    )

    twilio_account_sid: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_ACCOUNT_SID"),
    )
    twilio_auth_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_AUTH_TOKEN"),
    )
    twilio_whatsapp_from: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_WHATSAPP_FROM"),
    )
    twilio_voice_from: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_VOICE_FROM"),
    )
    twilio_sms_from: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TWILIO_SMS_FROM"),
    )
    sendgrid_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SENDGRID_API_KEY"),
    )
    sendgrid_from_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SENDGRID_FROM_EMAIL"),
    )
    vapi_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("VAPI_API_KEY"),
    )
    resend_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("RESEND_API_KEY"),
    )
    resend_from_email: str = Field(
        default="onboarding@resend.dev",
        validation_alias=AliasChoices("RESEND_FROM_EMAIL"),
    )

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"


settings = Settings()

init_agents(settings)


def get_supabase() -> Client:
    key = settings.supabase_service_role_key
    if not key or not key.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env (Project Settings → API → service_role). "
                "The anon key cannot upsert with RLS enabled."
            ),
        )
    return create_client(settings.supabase_project_url.strip(), key.strip())


# Initialize Learning Continuity Service
learning_continuity_service: LearningContinuityService | None = None
context_aware_agent: ContextAwareNovaAgent | None = None


app = FastAPI(title="Antigravity Onboarding", version="1.0.0")

app.include_router(agents_router)
app.include_router(assessments_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    global learning_continuity_service, context_aware_agent
    try:
        supabase = get_supabase()
        learning_continuity_service = LearningContinuityService(
            supabase_client=supabase,
            google_api_key=settings.google_api_key,
            gemini_model=settings.gemini_model,
        )
        context_aware_agent = ContextAwareNovaAgent(
            google_api_key=settings.google_api_key,
            gemini_model=settings.gemini_model,
        )
        # Initialize Assessment Services
        init_assessment_services(
            supabase_client=supabase,
            google_api_key=settings.google_api_key,
            gemini_model=settings.gemini_model,
        )
        logger.info("Learning Continuity, Context-Aware Agent, and Assessment services initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize services: {e}")


def _parse_json_field(json_str: str | None) -> any:
    """Safely parse JSON string from form data, returning None if invalid."""
    if not json_str or not json_str.strip():
        return None
    try:
        import json
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Failed to parse JSON field: {json_str[:100]}...")
        return None


@app.get("/api/health")
def health():
    agent_secret = (
        (settings.backend_agent_secret or "").strip() or (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    )
    return {
        "ok": True,
        "supabase_configured": bool(settings.supabase_service_role_key),
        "apify_configured": bool(settings.apify_api_token and settings.apify_api_token.strip()),
        "tavily_configured": bool(settings.tavily_api_key and settings.tavily_api_key.strip()),
        "groq_configured": bool(settings.groq_api_key and settings.groq_api_key.strip()),
        "google_llm_configured": bool(settings.google_api_key and settings.google_api_key.strip()),
        "agents_secret_configured": bool(agent_secret),
        "twilio_configured": bool(
            settings.twilio_account_sid
            and settings.twilio_auth_token
            and settings.twilio_account_sid.strip()
            and settings.twilio_auth_token.strip()
        ),
        "vapi_configured": bool(settings.vapi_api_key and settings.vapi_api_key.strip()),
    }


@app.post("/api/parse-pdf-text")
async def parse_pdf_text(
    file: UploadFile = File(...),
    x_agent_secret: str | None = Header(default=None, alias="X-Agent-Secret"),
):
    """Extract plain text from an uploaded PDF (Next.js server calls with X-Agent-Secret)."""
    expected = (
        (settings.backend_agent_secret or "").strip()
        or (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    )
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="BACKEND_AGENT_SECRET is not configured on the API server.",
        )
    if (x_agent_secret or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    name = (file.filename or "").strip() or "upload.pdf"
    if not name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="file must be a PDF")

    data = await file.read()
    if len(data) < 64:
        raise HTTPException(status_code=400, detail="PDF is empty or too small")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF exceeds 15MB limit")

    try:
        text = extract_text_from_pdf_bytes(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception:
        logger.exception("parse_pdf_text")
        raise HTTPException(status_code=502, detail="Could not parse PDF") from None

    return {"text": text, "char_count": len(text), "filename": name}


class YoutubePlaylistBody(BaseModel):
    playlist_url: str = Field(..., min_length=8, max_length=2048)


@app.post("/api/youtube-playlist-context")
async def youtube_playlist_context(
    body: YoutubePlaylistBody,
    x_agent_secret: str | None = Header(default=None, alias="X-Agent-Secret"),
):
    """Expand a YouTube playlist and aggregate captions (via youtube_handler) for Archie / Nova."""
    expected = (
        (settings.backend_agent_secret or "").strip()
        or (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    )
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="BACKEND_AGENT_SECRET is not configured on the API server.",
        )
    if (x_agent_secret or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    url = body.playlist_url.strip()
    low = url.lower()
    if "youtube" not in low and "youtu.be" not in low:
        raise HTTPException(status_code=400, detail="URL must be a YouTube link")

    def _run_playlist():
        from youtube_handler import build_nova_youtube_context_from_playlist_url

        return build_nova_youtube_context_from_playlist_url(url)

    try:
        ctx = await anyio.to_thread.run_sync(_run_playlist)
    except Exception as e:
        logger.exception("youtube_playlist_context")
        try:
            from yt_dlp.utils import DownloadError

            if isinstance(e, DownloadError):
                raise HTTPException(status_code=502, detail=str(e)) from e
        except ImportError:
            pass
        raise HTTPException(
            status_code=502,
            detail=f"Could not process playlist: {e!s}",
        ) from e

    patch = ctx.for_nova_dict()
    meta = patch.get("youtube_transcript_meta") or {}
    text = (ctx.nova_prompt_text or ctx.combined_text or "").strip()
    return {
        "text": text,
        "char_count": len(text),
        "playlist_url": url,
        "youtube_transcript_meta": meta,
        "source_urls": ctx.source_urls,
        "playlist_resolve_error": ctx.playlist_resolve_error,
    }


def _structured_nonempty(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, dict):
        return len(value) > 0
    if isinstance(value, list):
        return len(value) > 0
    return True


class VapiStructuredFetchBody(BaseModel):
    """Body for fetching `artifact.structuredOutputs` after a web call ends."""

    call_id: str = Field(..., min_length=1, description="Vapi call id from the web SDK (`call-start-success`).")


@app.post("/api/job-ready/mock-interview/vapi-structured")
async def fetch_vapi_structured_outputs(body: VapiStructuredFetchBody):
    """GET https://api.vapi.ai/call/{id} and return `artifact.structuredOutputs` (polls while Vapi finishes extraction)."""
    key = (settings.vapi_api_key or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="VAPI_API_KEY is not set on the Python server. Add it to backend/.env and restart.",
        )

    url = f"https://api.vapi.ai/call/{body.call_id.strip()}"
    headers = {"Authorization": f"Bearer {key}"}

    last: dict[str, Any] | None = None
    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(18):
            try:
                r = await client.get(url, headers=headers)
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Vapi request failed: {e!s}") from e

            if r.status_code == 404:
                raise HTTPException(status_code=404, detail="Vapi call not found")
            if not r.is_success:
                raise HTTPException(
                    status_code=502,
                    detail=f"Vapi error {r.status_code}: {r.text[:500]}",
                )

            try:
                last = r.json()
            except json.JSONDecodeError as e:
                raise HTTPException(status_code=502, detail="Invalid JSON from Vapi") from e

            artifact = (last or {}).get("artifact") or {}
            structured = artifact.get("structuredOutputs")
            if _structured_nonempty(structured):
                return {
                    "structuredOutputs": structured,
                    "artifact": artifact,
                }

            await asyncio.sleep(2)

    artifact = (last or {}).get("artifact") or {}
    return {
        "structuredOutputs": artifact.get("structuredOutputs"),
        "artifact": artifact,
        "pending": True,
    }


@app.post("/api/onboard")
async def onboard(
    linkedin_url: str = Form(...),
    resume_file: UploadFile = File(...),
):
    if not resume_file.filename or not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="resume_file must be a PDF")

    uid = uuid.uuid4()

    pdf_bytes = await resume_file.read()
    if len(pdf_bytes) < 64:
        raise HTTPException(status_code=400, detail="PDF file is too small or empty")

    try:
        linkedin_data, resume_data, linkedin_warning = await anyio.to_thread.run_sync(
            _run_extractions,
            linkedin_url,
            pdf_bytes,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception("Onboarding extraction failed")
        raise HTTPException(status_code=502, detail=f"Extraction failed: {e!s}") from e

    master = merge_profiles(linkedin_data, resume_data)
    if linkedin_warning:
        master["linkedin_import"] = {
            "status": "skipped",
            "reason": linkedin_warning[:2000],
        }
    extracted = build_extracted_skills(master)

    row = {
        "id": str(uid),
        "linkedin_url": linkedin_url.strip(),
        "master_profile": master,
        "extracted_skills": extracted,
    }

    try:
        supabase = get_supabase()
        supabase.table("users").insert(row).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Supabase upsert failed")
        raise HTTPException(status_code=502, detail=f"Database upsert failed: {e!s}") from e

@app.post("/api/scrape-linkedin")
async def scrape_linkedin(linkedin_url: str = Form(...)):
    try:
        linkedin_data, linkedin_warning = try_scrape_linkedin_profile(
            linkedin_url,
            settings.firecrawl_api_key,
            apify_api_token=settings.apify_api_token,
            apify_linkedin_actor=settings.apify_linkedin_actor,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception("LinkedIn scraping failed")
        raise HTTPException(status_code=502, detail=f"Scraping failed: {e!s}") from e

    # Merge with empty resume
    empty_resume = {}
    master = merge_profiles(linkedin_data, empty_resume)
    if linkedin_warning:
        master["linkedin_import"] = {
            "status": "skipped",
            "reason": linkedin_warning[:2000],
        }

    return master


def _parse_resume_only(pdf_bytes: bytes) -> dict:
    key = settings.google_api_key.strip() if settings.google_api_key else ""
    if not key:
        raise RuntimeError("GOOGLE_API_KEY is required for resume PDF parsing")
    return parse_resume_pdf(
        pdf_bytes,
        key,
        model_id=settings.gemini_model.strip() or "gemini-2.0-flash",
    )


@app.post("/api/parse-resume")
async def parse_resume(resume_file: UploadFile = File(...)):
    """Parse a resume PDF with Gemini; merge into the same `master` shape as LinkedIn scrape."""
    if not resume_file.filename or not resume_file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="resume_file must be a PDF")

    pdf_bytes = await resume_file.read()
    if len(pdf_bytes) < 64:
        raise HTTPException(status_code=400, detail="PDF file is too small or empty")

    try:
        resume_data = await anyio.to_thread.run_sync(_parse_resume_only, pdf_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        logger.exception("Resume parse failed")
        raise HTTPException(status_code=502, detail=f"Parse failed: {e!s}") from e

    master = merge_profiles({}, resume_data)
    return master


def _run_extractions(
    linkedin_url: str, pdf_bytes: bytes
) -> tuple[dict, dict, str | None]:
    """Run Apify (LinkedIn) + Firecrawl fallback + Gemini resume in one thread."""
    li, li_warn = try_scrape_linkedin_profile(
        linkedin_url,
        settings.firecrawl_api_key,
        apify_api_token=settings.apify_api_token,
        apify_linkedin_actor=settings.apify_linkedin_actor,
    )
    key = settings.google_api_key.strip() if settings.google_api_key else ""
    if not key:
        raise RuntimeError("GOOGLE_API_KEY is required for resume parsing")
    resume = parse_resume_pdf(
        pdf_bytes,
        key,
        model_id=settings.gemini_model.strip() or "gemini-2.0-flash",
    )
    return li, resume, li_warn


# ============================================================================
# Learning Continuity Endpoints
# ============================================================================


@app.post("/api/record-completion")
async def record_module_completion(
    user_id: str = Form(...),
    module_id: str = Form(...),
    path_id: str = Form(...),
    time_spent_minutes: int | None = Form(None),
    performance_score: float | None = Form(None),
    skills_acquired: str | None = Form(None),  # JSON array as string
):
    """Record a module completion for tracking learning continuity."""
    if not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Learning Continuity Service not available")

    try:
        skills = []
        if skills_acquired:
            skills = _parse_json_field(skills_acquired) or []

        result = await learning_continuity_service.record_module_completion(
            user_id=user_id,
            module_id=module_id,
            path_id=path_id,
            time_spent_minutes=time_spent_minutes,
            performance_score=performance_score,
            skills_acquired=skills,
        )
        return result
    except Exception as e:
        logger.exception("Failed to record module completion")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/detect-equivalencies")
async def detect_module_equivalencies(
    module_a_id: str = Form(...),
    module_a_data: str = Form(...),  # JSON string
    module_b_id: str = Form(...),
    module_b_data: str = Form(...),  # JSON string
):
    """Detect if two modules teach similar content using AI."""
    if not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Learning Continuity Service not available")

    try:
        module_a = _parse_json_field(module_a_data)
        module_b = _parse_json_field(module_b_data)

        if not module_a or not module_b:
            raise HTTPException(status_code=400, detail="Invalid JSON in module data")

        result = await learning_continuity_service.detect_module_equivalencies(
            module_a_id=module_a_id,
            module_a_data=module_a,
            module_b_id=module_b_id,
            module_b_data=module_b,
        )
        return result
    except Exception as e:
        logger.exception("Failed to detect module equivalencies")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/learning-history/{user_id}")
async def get_learning_history(user_id: str):
    """Get user's complete learning history and context across all paths."""
    if not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Learning Continuity Service not available")

    try:
        result = await learning_continuity_service.get_user_learning_history(user_id)
        return result
    except Exception as e:
        logger.exception("Failed to fetch learning history")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/filter-modules")
async def filter_modules_for_path(
    user_id: str = Form(...),
    modules_data: str = Form(...),  # JSON array string of modules
):
    """Filter modules for a new path based on what user has already learned."""
    if not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Learning Continuity Service not available")

    try:
        modules = _parse_json_field(modules_data)

        if not modules:
            raise HTTPException(status_code=400, detail="Invalid JSON in modules_data")

        result = await learning_continuity_service.filter_modules_for_new_path(
            user_id=user_id,
            new_path_modules=modules,
        )
        return result
    except Exception as e:
        logger.exception("Failed to filter modules")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/personalized-roadmap")
async def get_personalized_roadmap(
    user_id: str = Form(...),
    path_id: str = Form(...),
    modules_data: str = Form(...),  # JSON array string of modules
):
    """Generate a personalized roadmap based on user's learning history."""
    if not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Learning Continuity Service not available")

    try:
        modules = _parse_json_field(modules_data)

        if not modules:
            raise HTTPException(status_code=400, detail="Invalid JSON in modules_data")

        result = await learning_continuity_service.get_roadmap_with_context(
            user_id=user_id,
            new_path_id=path_id,
            new_path_modules=modules,
        )
        return result
    except Exception as e:
        logger.exception("Failed to generate personalized roadmap")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Context-Aware Nova Agent Endpoints
# ============================================================================


@app.post("/api/agent/generate-contextual-roadmap")
async def generate_contextual_roadmap(
    user_id: str = Form(...),
    target_path: str = Form(...),
    user_profile_data: str = Form(...),  # JSON
    available_modules_data: str = Form(...),  # JSON array
    syllabus_source_text: str | None = Form(default=None),
):
    """Generate context-aware roadmap using Nova agent with learning history."""
    if not context_aware_agent or not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Agent services not available")

    try:
        user_profile = _parse_json_field(user_profile_data)
        available_modules = _parse_json_field(available_modules_data)

        if not user_profile or not available_modules:
            raise HTTPException(status_code=400, detail="Invalid JSON in profile or modules data")

        # Get user's learning history
        learning_history = await learning_continuity_service.get_user_learning_history(user_id)

        # Filter modules based on what user already learned
        filtered_result = await learning_continuity_service.filter_modules_for_new_path(
            user_id=user_id,
            new_path_modules=available_modules,
        )

        # Generate context-aware roadmap using Nova agent
        syllabus = (syllabus_source_text or "").strip() or None

        roadmap = await context_aware_agent.generate_contextual_roadmap(
            user_profile=user_profile,
            target_path=target_path,
            learning_history=learning_history,
            available_modules=available_modules,
            filtered_modules=filtered_result.get("filtered_modules", []),
            skippable_modules=filtered_result.get("skippable_modules", []),
            syllabus_source_text=syllabus,
        )

        return roadmap
    except Exception as e:
        logger.exception("Failed to generate contextual roadmap")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agent/suggest-next-path")
async def suggest_next_learning_path(
    user_id: str = Form(...),
    candidate_paths_data: str = Form(...),  # JSON array
    syllabus_source_text: str | None = Form(default=None),
):
    """Use Nova agent to intelligently suggest best next learning path."""
    if not context_aware_agent or not learning_continuity_service:
        raise HTTPException(status_code=503, detail="Agent services not available")

    try:
        candidate_paths = _parse_json_field(candidate_paths_data)

        if not candidate_paths:
            raise HTTPException(status_code=400, detail="Invalid JSON in candidate_paths_data")

        # Get user's learning history
        learning_history = await learning_continuity_service.get_user_learning_history(user_id)

        # Get user's skills from endorsements
        skills = [
            s["skill_name"]
            for s in learning_history.get("skill_endorsements", [])[:30]
        ]

        # Get agent's recommendation
        syllabus = (syllabus_source_text or "").strip() or None

        recommendation = await context_aware_agent.suggest_learning_focus(
            user_id=user_id,
            candidate_paths=candidate_paths,
            learning_history=learning_history,
            user_skills=skills,
            syllabus_source_text=syllabus,
        )

        return recommendation
    except Exception as e:
        logger.exception("Failed to suggest next learning path")
        raise HTTPException(status_code=500, detail=str(e))


def _require_cron_secret(x_cron_secret: str | None) -> None:
    expected = (
        (settings.cron_secret or "").strip()
        or (os.environ.get("CRON_SECRET") or "").strip()
        or (settings.backend_agent_secret or "").strip()
        or (os.environ.get("BACKEND_AGENT_SECRET") or "").strip()
    )
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Configure CRON_SECRET or BACKEND_AGENT_SECRET for /api/cron/sparky/* routes.",
        )
    if (x_cron_secret or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/cron/sparky/daily-digest")
def cron_sparky_daily_digest(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """Optional batch sweep (same rules as dashboard-triggered digest). Not required if users open the app."""
    _require_cron_secret(x_cron_secret)
    from engagement_cron import run_daily_whatsapp_digest

    supabase = get_supabase()
    return run_daily_whatsapp_digest(settings=settings, supabase=supabase)


@app.post("/api/cron/sparky/inactivity-calls")
def cron_sparky_inactivity_calls(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """Voice re-engagement after 3+ days inactive; optional WhatsApp ping (profiles.notify_whatsapp_inactivity)."""
    _require_cron_secret(x_cron_secret)
    from engagement_cron import run_inactivity_voice_calls

    supabase = get_supabase()
    return run_inactivity_voice_calls(settings=settings, supabase=supabase)


@app.post("/api/cron/sparky/streak-reminders")
def cron_sparky_streak_reminders(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """Email (Resend) + WhatsApp streak nudges when UTC day not yet logged; includes focus + XP rank."""
    _require_cron_secret(x_cron_secret)
    from engagement_cron import run_streak_risk_reminders

    supabase = get_supabase()
    return run_streak_risk_reminders(settings=settings, supabase=supabase)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
