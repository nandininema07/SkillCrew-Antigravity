"""Tavily search API — used by Dexter when TAVILY_API_KEY is set."""

from __future__ import annotations

from typing import Any

import httpx


def tavily_search(*, api_key: str, query: str, max_results: int = 8) -> list[dict[str, Any]]:
    payload = {
        "api_key": api_key.strip(),
        "query": query.strip(),
        "max_results": max_results,
        "search_depth": "basic",
    }
    with httpx.Client(timeout=45.0) as client:
        r = client.post("https://api.tavily.com/search", json=payload)
    r.raise_for_status()
    data = r.json()
    return list(data.get("results") or [])
