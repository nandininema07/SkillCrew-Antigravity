"""Archie: learning roadmaps and certification ideas via Gemini (domain-agnostic)."""

from __future__ import annotations

import json
from typing import Any

from llm_client import llm_generate_json


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)

ARCHIE_SYSTEM = """You are Archie, a learning architect. You design personalized roadmaps for ANY domain:
healthcare, trades, arts, business, law, education, hospitality, agriculture, public service, sports, parenting,
software, data, etc. Never assume the learner is in technology unless their profile clearly says so.

Rules:
- Use ONLY the learner context provided (skills, experience summaries, stated direction, locale, pace, syllabus_source_text when present, youtube_transcript_context when present).
- **Sparse or mismatched profile (resume / LinkedIn):** If `skills` is empty, or `behavior_summary.profile_skills_empty` is true, or the listed skills and experiences do **not** clearly align with the learner's stated `direction` (e.g. generic LinkedIn tags unrelated to their goal), you MUST still output a **complete** roadmap. Infer milestones, module titles, and `conceptTags` from `direction`, `roadmap_intent`, and any syllabus or YouTube context — not from unrelated profile noise. Do **not** refuse generation, do **not** ask the user to add skills first, and do **not** pivot to an unrelated domain (e.g. software or DSA) unless `direction` is clearly about that field.
- When `direction` and saved `skills` conflict, **prioritize `direction` and `roadmap_intent`**; treat mismatched skills as optional background only.
- If `syllabus_source_text` is provided (extracted from a course PDF), align milestones and week titles with that material when possible; do not invent content not implied by the syllabus.
- If `youtube_transcript_context` is provided (captions aggregated from a YouTube playlist), align milestones, week titles, and contentSuggestions with that teaching sequence when possible; do not invent topics not supported by those transcripts.
- Structure: **One module = one calendar week** (one milestone). In the main section, include **exactly one `modules[]` entry per weekly milestone** — same count as `milestones`, and each module's `milestoneId` MUST equal that week's id (`week-1`, `week-2`, … in order). Do not put two modules in the same week.
- Each module MUST have `milestoneId` and a `guidedSequence` that starts with **at least FIVE `kind: "lesson"` steps** (minimum five lessons per module), each with a narrow title and summary, BEFORE the first quiz. Do not output fewer than five lessons per module.
  - Lessons: `{ "kind": "lesson", "id", "order", "title", "summary", "conceptTags": [], "resources": [{ "type", "title", "url?", "description?" }] }` — **each lesson MUST include several (typically 3–4) distinct YouTube resources** (`type: "youtube"`) when recommending video, plus articles/courses as needed. Spread links across lessons. Every URL in `contentSuggestions` MUST also appear in those lesson `resources`. Prefer real, resolvable `https://` URLs; avoid placeholder domains. The server may merge additional Tavily search results into `contentSuggestions`; your job is still to output coherent five+ lessons with **multiple videos per lesson**.
  - Quiz checkpoints: `{ "kind": "quiz_checkpoint", "id", "order", "title", "summary", "revisitsConcepts": ["string"], "checkpointTier": "quick" | "module_capstone" }` — use `quick` between lesson groups; use exactly one `module_capstone` at the **end** of each module. Spiral: `revisitsConcepts` names skills/topics to reinforce.
  - When revising a roadmap after feedback, put the global explanation in `planRationale`, and add `updateNote` on any NEW or CHANGED lesson explaining why that lesson was added or modified (short, learner-facing). Do NOT duplicate the full plan rationale inside every lesson.
- Also keep `contentSuggestions` on each module listing the same curated links as in lessons (for compatibility); they must stay in sync with lesson resources.
- Within each section, add `checkpoints` every 2–3 modules: each checkpoint has `afterModuleId` (a module id in that section), `title`, and `topicsCovered` for Pip assessments later.
- Honor `preferences` (difficulty_level, learning_pace, preferred_content) when choosing depth, counts, and suggestion mix. De-emphasize skills the learner already shows as strong unless a refresher is justified.
- Every explanation (planRationale, archieRationale, structureNote, certification rationales) must be YOUR original reasoning tied to that context — no template filler.
- Respect the roadmap_intent: "skills" = shorter, competency-focused path; "job_ready" = deeper outcomes toward employability or professional readiness in THEIR field; "certifications" is handled in a separate call.
- **Length:** Unless the learner context explicitly asks for a one-week crash/micro course, the roadmap MUST span **at least 8 calendar weeks** — i.e. `milestones.length >= 8`, ids `week-1` … `week-8` (and more if needed), `milestonesTotal >= 8`, and `weeklyTimeline.totalWeeks >= 8`. Never return a single-week plan for a full learning track.
- If `behavior_summary` (or top-level context) includes `roadmap_continuation: true` with `prior_display_level` / `completed_track_title`: this is **Level N+1** — advance `displayLevel` to `next_display_level` if provided (else prior+1), assume the learner finished the prior weeks, and design **deeper / applied / capstone** milestones that build on `completed_week_titles` without repeating fundamentals. Still use **at least 8 weeks** unless they asked for a micro path.
- Output strictly valid JSON matching the user schema. Use realistic week counts (typically 8–20) based on difficulty and pace.
- weeklyTimeline.archetype must be a short machine id (e.g. culinary_path, nursing_prep, indie_music, software_backend) and archetypeLabel a human label for THEIR journey (not a generic tech label unless appropriate).
- milestones: one per week, ordered. Include learningObjective per milestone (one clear sentence).
- status: week 1 "in_progress" (optionally with progressPercent 40–70); weeks 2+ "locked" as placeholders — the product unlocks later weeks only after the learner scores above 75% on Pip’s weekly quiz for the prior week (the app applies this; keep ids week-1, week-2, …).
- phaseLabel like "W1", "W2" matching week number.
- id for each milestone stable string "week-{n}".
"""


def build_roadmap_bundle(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    """context keys: skills[], experiences[], direction (free text), roadmap_intent, locale?, pace?, quiz_feedback?"""
    prompt = (
        "Learner context (JSON):\n"
        + _json_dumps(context)
        + "\n\nReturn a single JSON object with this shape:\n"
        + _json_dumps(ROADMAP_SHAPE_HINT)
        + "\nFill every field. weeklyTimeline.weeks must align with milestones order and length.\n"
        "CRITICAL: one module per week (modules.length === milestones.length). "
        "Unless the learner explicitly requested a one-week micro course, output AT LEAST 8 milestones (week-1 … week-8) and set weeklyTimeline.totalWeeks >= 8. "
        "Each module's guidedSequence MUST contain at least FIVE lesson objects (kind: lesson) with real https URLs in resources."
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=ARCHIE_SYSTEM,
        user_prompt=prompt,
        temperature=0.4,
    )


def revise_roadmap_bundle(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    current_bundle: dict[str, Any],
    adaptation_signals: dict[str, Any],
    learner_context: dict[str, Any],
) -> dict[str, Any]:
    prompt = (
        "Current roadmap JSON:\n"
        + _json_dumps(current_bundle)
        + "\n\nAdaptation signals (quiz results, chat concerns, coach notes, behavior, explicit requests "
        "to slow down / simplify / extend timeline / add basics):\n"
        + _json_dumps(adaptation_signals)
        + "\n\nRefreshed learner context:\n"
        + _json_dumps(learner_context)
        + "\n\nReturn a REVISED full roadmap JSON of the SAME shape as before (including `sections`, modules, "
        "`guidedSequence` per module, `milestoneId` on modules, contentSuggestions, checkpoints). "
        "Explain in planRationale what changed and WHY, referencing the signals; also set `updateNote` on affected lessons. "
        "If adaptation signals include weak quiz topics: add or reorder `guidedSequence` lessons and `quiz_checkpoint` "
        "steps that revisit those concepts before dependent later work, and adjust checkpoints. "
        "If the learner needs a slower path: extend total weeks, add foundation milestones, "
        "and shift estimated emphasis toward clarity over volume. If they want acceleration and "
        "signals support it, compress thoughtfully.\n"
        "Keep one module per week; each module must still have at least FIVE lessons in guidedSequence. "
        "Unless the learner asked for a micro course, maintain at least 8 weekly milestones when extending the timeline."
    )
    return llm_generate_json(
        groq_api_key=groq_api_key,
        groq_model=groq_model,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
        system_instruction=ARCHIE_SYSTEM,
        user_prompt=prompt,
        temperature=0.35,
    )


def build_certifications_bundle(
    *,
    groq_api_key: str | None,
    groq_model: str,
    google_api_key: str | None,
    gemini_model: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    system = (
        "You suggest credible certifications, licenses, diplomas, badges, or examinations "
        "appropriate to the learner's stated direction and geography/locale — any industry. "
        "Do not assume IT. If skills[] is empty or unrelated to direction, still propose credentials "
        "that match the stated direction only. Output JSON only."
    )
    prompt = (
        "Context:\n"
        + _json_dumps(context)
        + "\n\nReturn JSON: {\n"
        '  "targetRole": string (echo their direction),\n'
        '  "archetypeLabel": string (short human label for their field, not prescriptive),\n'
        '  "intro": string (2-4 sentences, your reasoning),\n'
        '  "items": [ { "id", "name", "provider", "focus", "archieRationale", "prepHint?" } ]\n'
        "}\nUse 4–8 items. archieRationale must justify each item for THIS learner."
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


ROADMAP_SHAPE_HINT: dict[str, Any] = {
    "trackTitle": "string",
    "trackProgressPercent": "number 0-100",
    "displayLevel": "number",
    "roleSubtitle": "string",
    "milestonesDone": "number",
    "milestonesTotal": "number",
    "displayXp": "number",
    "planRationale": "string",
    "milestones": [
        {
            "id": "week-1",
            "phaseLabel": "W1",
            "title": "string",
            "topics": ["string"],
            "learningObjective": "string",
            "statusLine": "string",
            "status": "completed|in_progress|available|locked",
            "progressPercent": "optional number",
            "xpReward": "optional number",
            "archieRationale": "string",
            "structureNote": "optional string",
        }
    ],
    "weeklyTimeline": {
        "archetype": "string",
        "archetypeLabel": "string",
        "phases": [{"name": "string", "weekStart": 1, "weekEnd": 3}],
        "weeks": [{"week": 1, "title": "string", "topics": ["string"]}],
        "totalWeeks": "number",
    },
    "sections": [
        {
            "id": "sec-1",
            "title": "string",
            "summary": "optional string",
            "modules": [
                {
                    "id": "mod-1",
                    "milestoneId": "week-1",
                    "title": "string",
                    "summary": "string",
                    "skills": ["string"],
                    "contentSuggestions": [
                        {
                            "type": "article|youtube|documentation|book|podcast|course|other",
                            "title": "string",
                            "url": "optional string",
                            "description": "optional string",
                        }
                    ],
                    "guidedSequence": [
                        {
                            "kind": "lesson",
                            "id": "lesson-1",
                            "order": 1,
                            "title": "string",
                            "summary": "string",
                            "conceptTags": ["string"],
                            "updateNote": "optional string — why this lesson exists after a plan change",
                            "resources": [
                                {
                                    "type": "article|youtube|documentation|book|podcast|course|other",
                                    "title": "string",
                                    "url": "https://…",
                                    "description": "optional string",
                                }
                            ],
                        },
                        {
                            "kind": "lesson",
                            "id": "lesson-2",
                            "order": 2,
                            "title": "string",
                            "summary": "string",
                            "conceptTags": ["string"],
                            "resources": [],
                        },
                        {
                            "kind": "lesson",
                            "id": "lesson-3",
                            "order": 3,
                            "title": "string",
                            "summary": "string",
                            "conceptTags": ["string"],
                            "resources": [],
                        },
                        {
                            "kind": "lesson",
                            "id": "lesson-4",
                            "order": 4,
                            "title": "string",
                            "summary": "string",
                            "conceptTags": ["string"],
                            "resources": [],
                        },
                        {
                            "kind": "lesson",
                            "id": "lesson-5",
                            "order": 5,
                            "title": "string",
                            "summary": "string",
                            "conceptTags": ["string"],
                            "resources": [],
                        },
                        {
                            "kind": "quiz_checkpoint",
                            "id": "quiz-a",
                            "order": 6,
                            "title": "string",
                            "summary": "string",
                            "revisitsConcepts": ["string"],
                            "checkpointTier": "quick",
                        },
                    ],
                }
            ],
            "checkpoints": [
                {
                    "id": "cp-1",
                    "afterModuleId": "mod-2",
                    "title": "string",
                    "topicsCovered": ["string"],
                }
            ],
        }
    ],
}
