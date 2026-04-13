"""Pip: quizzes, revision assets, structured feedback for Archie — via Groq/Gemini."""

from __future__ import annotations

import json
from typing import Any

from llm_client import llm_generate_json


def build_quiz(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    topics_learned: list[str],
    difficulty: str,
    count: int = 5,
    locale: str | None = None,
) -> dict[str, Any]:
    system = (
        "You are Pip, a fair assessment designer for ANY subject and industry — marketing, music, "
        "healthcare, law, trades, arts, business, software, etc. "
        "Create multiple-choice questions with one correct answer each (4 choices). "
        "Questions must match the topics provided. Do NOT assume technology: avoid programming, "
        "algorithms, or DSA unless the topics are explicitly about software, data, or engineering. "
        "Output JSON only."
    )
    ctx = {
        "topics_learned": topics_learned,
        "difficulty": difficulty,
        "question_count": count,
        "locale": locale or "en",
    }
    prompt = (
        json.dumps(ctx, ensure_ascii=False)
        + "\n\nReturn JSON: {\n"
        '  "quiz_id": string,\n'
        '  "questions": [ {\n'
        '    "id": string,\n'
        '    "prompt": string,\n'
        '    "choices": [string, string, string, string],\n'
        '    "correct_index": 0-3,\n'
        '    "explanation": string (teach the idea; no fluff)\n'
        "  } ]\n"
        "}"
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.35,
    )


def grade_quiz(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    quiz: dict[str, Any],
    answers: dict[str, int],
) -> dict[str, Any]:
    system = (
        "You are Pip. Grade the quiz. For each wrong answer, record misconception details "
        "for the learning architect. Output JSON only."
    )
    payload = {"quiz": quiz, "answers": answers}
    prompt = (
        json.dumps(payload, ensure_ascii=False)
        + "\n\nReturn JSON: {\n"
        '  "score_percent": number,\n'
        '  "mistakes": [ {\n'
        '    "question_id": string,\n'
        '    "topic": string,\n'
        '    "user_answer_index": number,\n'
        '    "correct_index": number,\n'
        '    "user_answer_text": string,\n'
        '    "correct_answer_text": string,\n'
        '    "misconception": string\n'
        "  } ],\n"
        '  "strengths": [string],\n'
        '  "pip_summary_for_archie": string (dense; what to change in the learning path)\n'
        "}"
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.2,
    )


def build_revision_pack(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    topics: list[str],
    notes: str | None,
    locale: str | None = None,
) -> dict[str, Any]:
    system = (
        "You are Pip. Build revision assets: a mind map, flashcards, and a spaced-repetition suggestion. "
        "Any domain. JSON only."
    )
    ctx = {"topics": topics, "learner_notes": notes or "", "locale": locale or "en"}
    prompt = (
        json.dumps(ctx, ensure_ascii=False)
        + "\n\nReturn JSON: {\n"
        '  "mindmap": { "root": string, "children": [ { "label": string, "children": [] } ] },\n'
        '  "flashcards": [ { "id": string, "front": string, "back": string, "difficulty": "easy"|"medium"|"hard" } ],\n'
        '  "revision_routine": { "daily_minutes": number, "cadence_hint": string, "priorities": [string] }\n'
        "}"
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.4,
    )


def build_checkpoint_assessment(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    topics_covered: list[str],
    preferences: dict[str, Any] | None = None,
    locale: str | None = None,
    question_count: int = 6,
    roadmap_direction: str | None = None,
    track_title: str | None = None,
    roadmap_mode: str | None = None,
) -> dict[str, Any]:
    system = (
        "You are Pip — a checkpoint designer for ANY profession or field: marketing, music, film, "
        "healthcare, nursing, law, education, trades, hospitality, sports, creative arts, business, "
        "parenting, software, data, etc. You are curious and fair, never judgmental.\n"
        "**Every question MUST be kind \"mcq\" only** — four choices, one correct answer. "
        "This checkpoint is multiple-choice only: do NOT emit coding, debug, or programming exercises. "
        "Even for technical roadmaps, prefer conceptual and applied MCQs (architecture, debugging concepts, "
        "best practices) over raw code drills unless the learner context explicitly demands code.\n"
        "For non-technical domains (e.g. marketing, music, writing, design): use scenario MCQs, terminology, "
        "listening/analysis (describe a scenario in text), best practices, interpretation, and application — "
        "never algorithms, data structures, LeetCode-style items, or unrelated IT trivia.\n"
        "Align every question with the learner's roadmap domain when provided (direction / track title) "
        "and with topics_covered. Vary question stems. Difficulty: easy|medium|hard — roughly 40% easy, "
        "35% medium, 25% hard.\n"
        "Each question: id (unique), kind must be \"mcq\", difficulty, topic (short label), prompt, "
        "choices (exactly 4 strings), correct_index (0-3), optional explanation_after_answer (one line). "
        "JSON only, no markdown outside strings."
    )
    ctx: dict[str, Any] = {
        "topics_covered": topics_covered,
        "preferences": preferences or {},
        "locale": locale or "en",
        "question_count": max(3, min(10, question_count)),
    }
    if roadmap_direction and str(roadmap_direction).strip():
        ctx["roadmap_direction"] = str(roadmap_direction).strip()
    if track_title and str(track_title).strip():
        ctx["track_title"] = str(track_title).strip()
    if roadmap_mode and str(roadmap_mode).strip():
        ctx["roadmap_mode"] = str(roadmap_mode).strip()

    prompt = (
        json.dumps(ctx, ensure_ascii=False)
        + "\n\nReturn JSON: {\n"
        '  "assessment_id": string,\n'
        '  "questions": [ {\n'
        '    "id": string, "kind": "mcq", "difficulty": "easy"|"medium"|"hard",\n'
        '    "topic": string, "prompt": string,\n'
        '    "choices": [string, string, string, string], "correct_index": number,\n'
        '    "explanation_after_answer": optional string\n'
        "  } ]\n"
        "}\n"
        'Every question must have kind exactly "mcq" and exactly four choices.'
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.35,
    )


def grade_checkpoint_assessment(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    assessment: dict[str, Any],
    answers: dict[str, Any],
) -> dict[str, Any]:
    system = (
        "You are Pip (the assessment fox). Grade fairly and constructively. "
        "Checkpoints are multiple-choice: for each question, compare answers[qid].mcq_index to correct_index. "
        "If a legacy coding/debug question appears, grade answers[qid].text against grading_rubric when present. "
        "For each item, note should be short, encouraging, and actionable (if wrong, hint what to review). "
        "weak_topics must use vocabulary from the learner's domain (marketing, music, etc.) — not generic tech. "
        "Collect weak_topics from topics where the learner missed. "
        "pip_summary_for_archie must be dense: what Archie should reinforce or reorder in the roadmap, "
        "and suggest flashcard-style facts for mistakes (one line). JSON only."
    )
    prompt = (
        json.dumps({"assessment": assessment, "answers": answers}, ensure_ascii=False)
        + "\n\nReturn JSON: {\n"
        '  "results": [ { "question_id": string, "correct": boolean, "topic": string, "difficulty": string, "kind": string, "note": string } ],\n'
        '  "score_percent": number (0-100),\n'
        '  "weak_topics": [string],\n'
        '  "pip_summary_for_archie": string,\n'
        '  "flashcard_suggestions": [ { "front": string, "back": string, "from_question_id": string } ] (optional; from wrong answers)\n'
        "}"
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=system,
        user_prompt=prompt,
        temperature=0.15,
    )
