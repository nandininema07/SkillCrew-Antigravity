"""Unified JSON LLM: Groq (OpenAI-compatible) when GROQ_API_KEY is set, else Gemini."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from gemini_json import gemini_generate_json

logger = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def _parse_json_fuzzy(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    out = json.loads(text)
    if not isinstance(out, dict):
        raise ValueError("root must be object")
    return out


def groq_generate_json(
    *,
    api_key: str,
    model: str,
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.35,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": model.strip() or "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }
    # json_mode when supported
    body["response_format"] = {"type": "json_object"}

    with httpx.Client(timeout=120.0) as client:
        r = client.post(GROQ_CHAT_URL, headers=headers, json=body)
    if r.status_code >= 400:
        logger.warning("Groq error %s: %s", r.status_code, r.text[:800])
        raise RuntimeError(f"Groq HTTP {r.status_code}")
    data = r.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("Groq returned no choices")
    msg = choices[0].get("message") or {}
    content = (msg.get("content") or "").strip()
    if not content:
        raise RuntimeError("Groq empty content")
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return _parse_json_fuzzy(content)


def llm_generate_json(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.35,
) -> dict[str, Any]:
    # Groq first — it generates structured JSON ~4-6× faster than Gemini
    if groq_api_key and groq_api_key.strip():
        try:
            return groq_generate_json(
                api_key=groq_api_key,
                model=groq_model,
                system_instruction=system_instruction,
                user_prompt=user_prompt,
                temperature=temperature,
            )
        except Exception as e:
            logger.warning("Groq failed, falling back to Gemini if available: %s", str(e)[:300])
            if not (google_api_key and google_api_key.strip()):
                raise

    # Fallback to Gemini
    if google_api_key and google_api_key.strip():
        return gemini_generate_json(
            api_key=google_api_key.strip(),
            model_id=gemini_model.strip() or "gemini-2.0-flash",
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            temperature=temperature,
        )
    raise RuntimeError("Configure GROQ_API_KEY and/or GOOGLE_API_KEY")
