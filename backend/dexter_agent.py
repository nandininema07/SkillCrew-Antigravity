"""Dexter: learning resources via Tavily (preferred) or Apify Google search."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from apify_client import ApifyClient

from tavily_client import tavily_search

logger = logging.getLogger(__name__)

DEFAULT_GOOGLE_SEARCH_ACTOR = "apify/google-search-scraper"


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def _bucket(url: str) -> str:
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
        )
    ):
        return "courses"
    if any(
        x in h
        for x in (
            "credly.com",
            "pearsonvue.com",
            "peoplecert.org",
            "pmi.org",
            "comptia.org",
            "aws.amazon.com/certification",
        )
    ):
        return "certifications"
    return "articles"


def _empty_buckets() -> dict[str, list[dict[str, str]]]:
    return {"youtube": [], "courses": [], "certifications": [], "articles": []}


def _fill_buckets_from_urls(rows: list[dict[str, str]], max_per: int) -> dict[str, list[dict[str, str]]]:
    buckets = _empty_buckets()
    for row in rows:
        url = row.get("url") or ""
        if not url.startswith("http"):
            continue
        b = _bucket(url)
        if len(buckets[b]) < max_per:
            buckets[b].append(row)
    return buckets


def fetch_resources_tavily_modules(
    *,
    tavily_api_key: str,
    modules: list[dict[str, Any]],
    max_results_per_module: int = 8,
) -> dict[str, Any]:
    by_module: dict[str, Any] = {}
    for m in modules:
        mid = str(m.get("id") or "").strip()
        title = str(m.get("title") or "").strip()
        obj = str(m.get("learning_objective") or m.get("learningObjective") or "").strip()
        if not mid or not title:
            continue
        query = f"best learning resources tutorials courses articles certifications: {title}. {obj}".strip()
        if len(query) > 400:
            query = query[:400]
        try:
            raw = tavily_search(api_key=tavily_api_key, query=query, max_results=max_results_per_module)
        except Exception as e:
            logger.warning("Tavily failed for %s: %s", mid, str(e)[:400])
            by_module[mid] = {**_empty_buckets(), "error": str(e)[:500]}
            continue
        rows: list[dict[str, str]] = []
        for it in raw:
            if not isinstance(it, dict):
                continue
            url = str(it.get("url") or "").strip()
            if not url.startswith("http"):
                continue
            t = str(it.get("title") or url)[:200]
            desc = str(it.get("content") or it.get("snippet") or "")[:500]
            rows.append({"title": t, "url": url, "description": desc})
        by_module[mid] = _fill_buckets_from_urls(rows, max_results_per_module)
    return {"byModuleId": by_module, "provider": "tavily"}


def fetch_resources_apify_modules(
    *,
    apify_token: str,
    actor_id: str,
    modules: list[dict[str, Any]],
    max_results_per_module: int = 8,
) -> dict[str, Any]:
    client = ApifyClient(apify_token)
    aid = (actor_id or DEFAULT_GOOGLE_SEARCH_ACTOR).strip() or DEFAULT_GOOGLE_SEARCH_ACTOR
    by_module: dict[str, Any] = {}

    for m in modules:
        mid = str(m.get("id") or "").strip()
        title = str(m.get("title") or "").strip()
        obj = str(m.get("learning_objective") or m.get("learningObjective") or "").strip()
        if not mid or not title:
            continue
        query = f"{title}. {obj}".strip()
        if len(query) > 280:
            query = query[:280]

        run_input: dict[str, Any] = {
            "queries": query,
            "maxPagesPerQuery": 1,
            "resultsPerPage": max_results_per_module,
            "mobileResults": False,
        }
        try:
            run = client.actor(aid).call(run_input=run_input, wait_secs=300)
        except Exception as e:
            logger.warning("Apify actor run failed for module %s: %s", mid, str(e)[:400])
            by_module[mid] = {**_empty_buckets(), "error": str(e)[:500]}
            continue

        dataset_id = run.get("defaultDatasetId") if isinstance(run, dict) else None
        if not dataset_id:
            by_module[mid] = {**_empty_buckets(), "error": "no_dataset"}
            continue

        rows: list[dict[str, str]] = []
        for item in client.dataset(dataset_id).iterate_items():
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or item.get("link") or "").strip()
            if not url.startswith("http"):
                continue
            t = str(item.get("title") or item.get("pageTitle") or url).strip()
            desc = str(item.get("description") or item.get("snippet") or "").strip()
            rows.append({"title": t[:200], "url": url, "description": desc[:500] if desc else ""})

        by_module[mid] = _fill_buckets_from_urls(rows, max_results_per_module)

    return {"byModuleId": by_module, "provider": "apify"}


def fetch_resources_auto(
    *,
    tavily_api_key: str | None,
    apify_api_token: str | None,
    apify_google_actor: str,
    modules: list[dict[str, Any]],
    max_results_per_module: int = 8,
) -> dict[str, Any]:
    if tavily_api_key and tavily_api_key.strip():
        return fetch_resources_tavily_modules(
            tavily_api_key=tavily_api_key.strip(),
            modules=modules,
            max_results_per_module=max_results_per_module,
        )
    if apify_api_token and apify_api_token.strip():
        return fetch_resources_apify_modules(
            apify_token=apify_api_token.strip(),
            actor_id=apify_google_actor,
            modules=modules,
            max_results_per_module=max_results_per_module,
        )
    raise RuntimeError("Set TAVILY_API_KEY or APIFY_API_TOKEN for Dexter")
