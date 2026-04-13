"""Merge Tavily search results into Archie roadmap modules so lessons get real, clickable URLs."""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from typing import Any
from urllib.parse import quote, urlparse

import httpx

from tavily_client import tavily_search

logger = logging.getLogger(__name__)

# How many modules to enrich at the same time.
# Keeps Tavily + oEmbed HTTP connections bounded while fully overlapping I/O.
_MODULE_WORKERS = 8
# How many oEmbed checks to run in parallel within a single module's suggestions.
_OEMBED_WORKERS = 12


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def _looks_like_youtube_url(url: str) -> bool:
    h = _host(url)
    return "youtube.com" in h or "youtu.be" in h


@lru_cache(maxsize=512)
def _youtube_oembed_available(url: str) -> bool:
    """True if YouTube exposes oEmbed for this URL (public / embeddable). Private or removed videos fail."""
    if not url.startswith("http") or not _looks_like_youtube_url(url):
        return True
    api = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
    try:
        with httpx.Client(timeout=12.0, follow_redirects=True) as client:
            r = client.get(api)
            return r.status_code == 200
    except Exception as e:
        logger.debug("oEmbed check failed for %s: %s", url[:80], str(e)[:120])
        return False


def _suggestion_type_for_url(url: str) -> str:
    h = _host(url)
    if "youtube.com" in h or "youtu.be" in h:
        return "youtube"
    if any(
        x in h
        for x in (
            "coursera.org",
            "udemy.com",
            "edx.org",
            "linkedin.com/learning",
            "pluralsight.com",
            "skillshare.com",
            "khanacademy.org",
            "futurelearn.com",
            "mit.edu",
            "stanford.edu",
        )
    ):
        return "course"
    if any(x in h for x in ("medium.com", "dev.to", "substack.com", "arxiv.org")):
        return "article"
    if any(x in h for x in ("docs.", "documentation", "readthedocs")):
        return "documentation"
    return "article"


def _merge_tavily_into_suggestions(existing: list[dict[str, Any]], rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for x in existing:
        if not isinstance(x, dict):
            continue
        u = str(x.get("url") or "").strip()
        if u.startswith("http"):
            seen.add(u.lower().split("#")[0])
        out.append(x)
    for it in rows:
        if not isinstance(it, dict):
            continue
        u = str(it.get("url") or "").strip()
        if not u.startswith("http"):
            continue
        key = u.lower().split("#")[0]
        if key in seen:
            continue
        seen.add(key)
        t = str(it.get("title") or u)[:220]
        desc = str(it.get("content") or it.get("snippet") or "")[:500]
        out.append(
            {
                "type": _suggestion_type_for_url(u),
                "title": t,
                "url": u,
                "description": desc,
            }
        )
    return out


def _filter_youtube_suggestions_parallel(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop YouTube entries that fail oEmbed. Checks run in parallel to avoid serial latency."""
    # Separate YouTube items that need checking from everything else.
    yt_items: list[tuple[int, dict[str, Any]]] = []
    non_yt: list[tuple[int, dict[str, Any]]] = []
    for idx, x in enumerate(items):
        if not isinstance(x, dict):
            continue
        u = str(x.get("url") or "").strip()
        t = str(x.get("type") or "").lower()
        if u.startswith("http") and (t == "youtube" or _looks_like_youtube_url(u)):
            yt_items.append((idx, x))
        else:
            non_yt.append((idx, x))

    if not yt_items:
        return [x for _, x in sorted(non_yt, key=lambda p: p[0])]

    # Run oEmbed checks in parallel.
    keep_indices: set[int] = set()
    with ThreadPoolExecutor(max_workers=_OEMBED_WORKERS) as pool:
        futures = {
            pool.submit(_youtube_oembed_available, x.get("url", "")): (idx, x)
            for idx, x in yt_items
        }
        for future in as_completed(futures):
            idx, x = futures[future]
            try:
                available = future.result()
            except Exception:
                available = False
            if available:
                keep_indices.add(idx)
            else:
                logger.info("Removing unavailable YouTube from roadmap suggestions: %s", str(x.get("url", ""))[:100])

    # Rebuild preserving original order.
    kept: list[tuple[int, dict[str, Any]]] = non_yt + [
        (idx, x) for idx, x in yt_items if idx in keep_indices
    ]
    return [x for _, x in sorted(kept, key=lambda p: p[0])]


def _fetch_tavily_for_module(api_key: str, title: str, skills: list[Any], summary: str) -> list[dict[str, Any]]:
    skill_txt = " ".join(str(s) for s in (skills or [])[:6] if s)
    base = f"best learning resources tutorials courses articles to study: {title}. {skill_txt} {summary[:240]}".strip()
    if len(base) > 420:
        base = base[:420]
    rows: list[dict[str, Any]] = []
    try:
        rows.extend(tavily_search(api_key=api_key, query=base, max_results=14))
    except Exception as e:
        logger.warning("Tavily primary query failed for %s: %s", title[:80], str(e)[:300])
    yt_q = f"site:youtube.com {title} tutorial lecture course explained {skill_txt}"[:400]
    try:
        rows.extend(tavily_search(api_key=api_key, query=yt_q, max_results=18))
    except Exception as e:
        logger.warning("Tavily YouTube query failed for %s: %s", title[:80], str(e)[:300])
    if len(rows) < 12:
        q2 = f"{title} tutorial OR course OR documentation {skill_txt}"[:400]
        try:
            rows.extend(tavily_search(api_key=api_key, query=q2, max_results=10))
        except Exception as e:
            logger.warning("Tavily fallback query failed: %s", str(e)[:300])
    return rows


def _enrich_single_module(api_key: str, mod: dict[str, Any]) -> None:
    """Enrich one module in-place: fetch Tavily rows, merge, then validate YouTube links."""
    title = str(mod.get("title") or "").strip()
    if not title:
        return
    skills = mod.get("skills") or []
    summary = str(mod.get("summary") or "")
    raw_rows = _fetch_tavily_for_module(api_key, title, skills if isinstance(skills, list) else [], summary)
    existing = mod.get("contentSuggestions")
    if not isinstance(existing, list):
        existing = []
    clean = [x for x in existing if isinstance(x, dict)]
    merged = _merge_tavily_into_suggestions(clean, raw_rows)
    mod["contentSuggestions"] = _filter_youtube_suggestions_parallel(merged)


def enrich_archie_bundle_with_tavily(bundle: dict[str, Any], tavily_api_key: str | None) -> dict[str, Any]:
    """Append Tavily-backed URLs to each module's contentSuggestions (deduped).
    All modules are enriched in parallel; oEmbed checks within each module are also parallelised.
    """
    if not tavily_api_key or not str(tavily_api_key).strip():
        return bundle
    key = str(tavily_api_key).strip()
    sections = bundle.get("sections")
    if not isinstance(sections, list):
        return bundle

    # Collect all modules across all sections.
    all_mods: list[dict[str, Any]] = []
    for sec in sections:
        if not isinstance(sec, dict):
            continue
        modules = sec.get("modules")
        if not isinstance(modules, list):
            continue
        for mod in modules:
            if isinstance(mod, dict) and str(mod.get("title") or "").strip():
                all_mods.append(mod)

    if not all_mods:
        return bundle

    # Enrich all modules concurrently.
    with ThreadPoolExecutor(max_workers=min(_MODULE_WORKERS, len(all_mods))) as pool:
        futures = [pool.submit(_enrich_single_module, key, mod) for mod in all_mods]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                logger.warning("Module enrichment failed: %s", str(e)[:300])

    return bundle
