"""LinkedIn via Apify Actor, Firecrawl fallback, and Gemini (resume PDF)."""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from typing import Any
from urllib.parse import urlparse

import google.generativeai as genai
from apify_client import ApifyClient
from firecrawl import V1FirecrawlApp
from firecrawl.v1.client import V1JsonConfig

from nova_agent import dedupe_strings

logger = logging.getLogger(__name__)

# Default: harvestapi/linkedin-profile-scraper (see Apify Store; input uses profile URLs)
DEFAULT_APIFY_LINKEDIN_ACTOR = "harvestapi/linkedin-profile-scraper"
APIFY_PROFILE_MODE_NO_EMAIL = "Profile details no email ($4 per 1k)"

LINKEDIN_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "skills": {"type": "array", "items": {"type": "string"}},
        "experience": {"type": "array", "items": {"type": "string"}},
        "current_role": {"type": "string"},
    },
    "additionalProperties": True,
}


def normalize_linkedin_url(url: str) -> str:
    u = url.strip()
    if not u.startswith(("http://", "https://")):
        u = "https://" + u
    return u


def _is_linkedin_host(url: str) -> bool:
    try:
        netloc = urlparse(normalize_linkedin_url(url)).netloc.lower()
    except Exception:
        return False
    return "linkedin.com" in netloc


def _is_likely_scrape_blocked_message(msg: str) -> bool:
    lower = msg.lower()
    markers = (
        "not support",
        "not supported",
        "unsupported",
        "do not support",
        "website not supported",
        "cannot scrape",
        "restricted",
        "blocked",
        "apologize",
    )
    return any(m in lower for m in markers)


def apify_item_to_canonical(item: dict[str, Any]) -> dict[str, Any]:
    """Map harvestapi/linkedin-profile-scraper dataset item → skills / experience / current_role."""
    errs = item.get("error")
    if isinstance(errs, list) and len(errs) > 0:
        first = errs[0] if isinstance(errs[0], dict) else {}
        err_msg = first.get("error") if isinstance(first, dict) else None
        raise RuntimeError(err_msg or str(errs))

    skills: list[str] = []
    for s in item.get("skills") or []:
        if isinstance(s, dict):
            name = s.get("name")
            if isinstance(name, str) and name.strip():
                skills.append(name.strip())

    exp: list[str] = []
    for ex in item.get("experience") or []:
        if not isinstance(ex, dict):
            continue
        pos = (ex.get("position") or "").strip()
        comp = (ex.get("companyName") or "").strip()
        loc = (ex.get("location") or "").strip()
        if pos and comp:
            line = f"{pos} at {comp}"
            if loc:
                line += f" ({loc})"
            exp.append(line)
        elif pos:
            exp.append(pos)
        elif comp:
            exp.append(comp)

    current_role = (item.get("headline") or "").strip() or None
    cps = item.get("currentPosition")
    if not current_role and isinstance(cps, list) and cps:
        c0 = cps[0]
        if isinstance(c0, dict):
            cn = (c0.get("companyName") or "").strip()
            if cn:
                current_role = cn

    if item.get("topSkills") and isinstance(item["topSkills"], str):
        for part in item["topSkills"].split(","):
            t = part.strip()
            if t:
                skills.append(t)

    return {
        "skills": dedupe_strings(skills),
        "experience": dedupe_strings(exp),
        "current_role": current_role,
        "source": "apify",
    }


def fetch_linkedin_via_apify(
    linkedin_url: str,
    apify_token: str,
    actor_id: str = DEFAULT_APIFY_LINKEDIN_ACTOR,
    wait_secs: int = 300,
) -> dict[str, Any]:
    """Run Apify LinkedIn Profile Scraper and return canonical profile dict."""
    client = ApifyClient(apify_token)
    url = normalize_linkedin_url(linkedin_url)
    run_input: dict[str, Any] = {
        "profileScraperMode": APIFY_PROFILE_MODE_NO_EMAIL,
        "urls": [url],
    }
    run = client.actor(actor_id).call(run_input=run_input, wait_secs=wait_secs)
    if not run or not isinstance(run, dict):
        raise RuntimeError("Apify run returned no result")
    dataset_id = run.get("defaultDatasetId")
    if not dataset_id:
        raise RuntimeError("Apify run finished without a default dataset")

    items: list[dict[str, Any]] = []
    for it in client.dataset(dataset_id).iterate_items():
        if isinstance(it, dict):
            items.append(it)
    if not items:
        raise RuntimeError("Apify returned no profile items")

    return apify_item_to_canonical(items[0])


def try_scrape_linkedin_profile(
    linkedin_url: str,
    firecrawl_api_key: str,
    *,
    apify_api_token: str | None = None,
    apify_linkedin_actor: str = DEFAULT_APIFY_LINKEDIN_ACTOR,
) -> tuple[dict[str, Any], str | None]:
    """
    Prefer Apify LinkedIn Actor for linkedin.com URLs when APIFY_API_TOKEN is set.
    Otherwise use Firecrawl JSON extract. On blocked / unsupported sites, returns ({}, warning).
    """
    if _is_linkedin_host(linkedin_url) and apify_api_token and apify_api_token.strip():
        try:
            data = fetch_linkedin_via_apify(
                linkedin_url,
                apify_api_token.strip(),
                actor_id=apify_linkedin_actor.strip() or DEFAULT_APIFY_LINKEDIN_ACTOR,
            )
            if data:
                return data, None
        except Exception as e:
            logger.warning("Apify LinkedIn scrape failed, trying Firecrawl: %s", str(e)[:400])

    try:
        data = scrape_linkedin_profile(linkedin_url, firecrawl_api_key)
        return data, None
    except Exception as e:
        msg = str(e).strip() or repr(e)
        if _is_linkedin_host(linkedin_url) or _is_likely_scrape_blocked_message(msg):
            logger.warning("LinkedIn/site scrape skipped, using resume only: %s", msg[:300])
            return {}, msg
        raise RuntimeError(msg) from e


def scrape_linkedin_profile(linkedin_url: str, api_key: str) -> dict[str, Any]:
    """Firecrawl v1 scrape_url with JSON extraction schema."""
    app = V1FirecrawlApp(api_key=api_key)
    url = normalize_linkedin_url(linkedin_url)
    resp = app.scrape_url(
        url,
        formats=["json"],
        json_options=V1JsonConfig(schema=LINKEDIN_JSON_SCHEMA),
    )
    if not getattr(resp, "success", True):
        err = getattr(resp, "error", None) or "Firecrawl scrape failed"
        logger.warning("Firecrawl scrape success=false: %s", err)
        raise RuntimeError(err)

    data: Any = None
    if hasattr(resp, "model_dump"):
        dumped = resp.model_dump(by_alias=True)
        data = dumped.get("json") or dumped.get("json_field")
    if data is None:
        data = getattr(resp, "json", None) or getattr(resp, "json_field", None)
    if data is None:
        return {}
    if isinstance(data, dict):
        return data
    return {}


def parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


RESUME_PROMPT = """You are extracting structured data from a resume PDF.
Return ONLY valid JSON (no markdown, no commentary) with exactly these keys:
- "technical_skills": array of short skill strings (languages, frameworks, tools, platforms)
- "project_keywords": array of short phrases naming projects, domains, or notable work (deduplicated)

If a field is unknown, use an empty array."""


def parse_resume_pdf(
    pdf_bytes: bytes,
    google_api_key: str,
    *,
    model_id: str = "gemini-2.0-flash",
) -> dict[str, Any]:
    """Gemini 3.1 Flash-Lite (preview): extract technical_skills and project_keywords from PDF."""
    genai.configure(api_key=google_api_key)
    model = genai.GenerativeModel(model_id)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        path = tmp.name

    try:
        upload = genai.upload_file(path, mime_type="application/pdf")
        response = model.generate_content([RESUME_PROMPT, upload])
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass

    text = getattr(response, "text", None) or ""
    if not text.strip():
        raise RuntimeError("Gemini returned empty response for resume")

    try:
        return parse_json_object(text)
    except json.JSONDecodeError as e:
        logger.exception("Gemini JSON parse failed: %s", text[:500])
        raise RuntimeError("Gemini output was not valid JSON") from e
