"""Shared Gemini JSON generation."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai

logger = logging.getLogger(__name__)

# Prefer widely available model ids; preview names may 404 for some API keys / regions.
_GEMINI_MODEL_FALLBACKS: tuple[str, ...] = (
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-3.1-flash-lite-preview",
)


def parse_json_object(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


def _one_generate(
    *,
    api_key: str,
    model_id: str,
    system_instruction: str,
    user_prompt: str,
    temperature: float,
) -> dict[str, Any]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_id,
        system_instruction=system_instruction,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=temperature,
        ),
    )
    response = model.generate_content(user_prompt)
    text = getattr(response, "text", None) or ""
    if not text.strip():
        raise RuntimeError("Gemini returned empty response")
    try:
        out = json.loads(text)
    except json.JSONDecodeError:
        out = parse_json_object(text)
    if not isinstance(out, dict):
        raise RuntimeError("Gemini JSON root must be an object")
    return out


def gemini_generate_json(
    *,
    api_key: str,
    model_id: str,
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.35,
) -> dict[str, Any]:
    primary = (model_id or "").strip() or "gemini-2.0-flash"
    chain: list[str] = []
    for m in (primary, *_GEMINI_MODEL_FALLBACKS):
        if m and m not in chain:
            chain.append(m)

    last: Exception | None = None
    for mid in chain:
        try:
            return _one_generate(
                api_key=api_key,
                model_id=mid,
                system_instruction=system_instruction,
                user_prompt=user_prompt,
                temperature=temperature,
            )
        except Exception as e:
            last = e
            if mid != chain[-1]:
                logger.warning("Gemini model %s failed, trying fallback: %s", mid, str(e)[:280])
            continue
    raise RuntimeError(str(last) if last else "All Gemini models failed") from last
