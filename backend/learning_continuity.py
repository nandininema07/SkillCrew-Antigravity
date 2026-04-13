"""Learning Continuity Service - Track skills across learning paths with AI-powered cross-path detection."""

from __future__ import annotations

import json
import logging
from typing import Any

import google.generativeai as genai
from supabase import Client

logger = logging.getLogger(__name__)


class LearningContinuityService:
    """Service for managing learning history and cross-path module equivalency."""

    def __init__(self, supabase_client: Client, google_api_key: str, gemini_model: str = "gemini-2.0-flash"):
        self.supabase = supabase_client
        self.gemini_model = gemini_model
        genai.configure(api_key=google_api_key)

    async def record_module_completion(
        self,
        user_id: str,
        module_id: str,
        path_id: str,
        time_spent_minutes: int | None = None,
        performance_score: float | None = None,
        skills_acquired: list[str] | None = None,
    ) -> dict[str, Any]:
        """Record that a user has completed a module and the skills they learned."""
        try:
            completion_data = {
                "user_id": user_id,
                "module_id": module_id,
                "path_id": path_id,
                "time_spent_minutes": time_spent_minutes,
                "performance_score": performance_score,
                "skills_acquired": skills_acquired or [],
            }

            # Record completion
            response = self.supabase.table("module_completions").insert(completion_data).execute()

            # Add skill endorsements
            if skills_acquired:
                for skill in skills_acquired:
                    self.supabase.table("skill_endorsements").insert({
                        "user_id": user_id,
                        "skill_name": skill,
                        "source_module_id": module_id,
                        "source_path_id": path_id,
                        "proficiency_level": "beginner",
                    }).execute()

            return {"success": True, "completion_id": response.data[0]["id"] if response.data else None}
        except Exception as e:
            logger.error(f"Error recording module completion: {e}")
            return {"success": False, "error": str(e)}

    async def detect_module_equivalencies(
        self,
        module_a_id: str,
        module_a_data: dict[str, Any],
        module_b_id: str,
        module_b_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Use Gemini AI to detect if two modules teach similar content (semantic similarity)."""
        try:
            prompt = f"""Analyze these two learning modules and determine their semantic similarity.

Module A: "{module_a_data.get('title', '')}"
Description: {module_a_data.get('description', '')}
Skills: {', '.join(module_a_data.get('skills', []))}

Module B: "{module_b_data.get('title', '')}"
Description: {module_b_data.get('description', '')}
Skills: {', '.join(module_b_data.get('skills', []))}

Provide:
1. A similarity score from 0 to 1 (0 = completely different, 1 = identical)
2. List the overlapping skills/topics that both modules teach
3. Brief explanation of why they are similar/different

Format as JSON: {{"similarity_score": 0.0, "overlapping_skills": [], "explanation": ""}}"""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            # Parse the JSON response
            response_text = response.text
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                analysis = json.loads(json_str)
            else:
                analysis = {
                    "similarity_score": 0.0,
                    "overlapping_skills": [],
                    "explanation": response_text
                }

            # Store equivalency if similarity is above threshold
            similarity_score = float(analysis.get("similarity_score", 0))
            if similarity_score >= 0.5:  # Threshold for considering modules equivalent
                equivalency_data = {
                    "module_a_id": module_a_id,
                    "module_b_id": module_b_id,
                    "similarity_score": similarity_score,
                    "overlapping_skills": analysis.get("overlapping_skills", []),
                    "detected_by": "ai_analysis",
                }
                self.supabase.table("module_equivalencies").insert(equivalency_data).execute()

            return {
                "success": True,
                "similarity_score": similarity_score,
                "overlapping_skills": analysis.get("overlapping_skills", []),
                "explanation": analysis.get("explanation", ""),
                "is_equivalent": similarity_score >= 0.5,
            }
        except Exception as e:
            logger.error(f"Error detecting module equivalencies: {e}")
            return {
                "success": False,
                "error": str(e),
                "similarity_score": 0,
                "is_equivalent": False,
            }

    async def get_user_completed_modules(self, user_id: str) -> list[dict[str, Any]]:
        """Get all modules completed by a user across all paths."""
        try:
            response = self.supabase.table("module_completions").select(
                "module_id, path_id, completed_at, skills_acquired, performance_score"
            ).eq("user_id", user_id).order("completed_at", desc=True).execute()

            return response.data or []
        except Exception as e:
            logger.error(f"Error fetching user's completed modules: {e}")
            return []

    async def get_user_learning_history(self, user_id: str) -> dict[str, Any]:
        """Get user's complete learning history/context across all paths."""
        try:
            # Get learning context history (paths in chronological order)
            history_response = self.supabase.table("learning_context_history").select(
                "*"
            ).eq("user_id", user_id).order("enrollment_order", desc=False).execute()

            # Get completed modules and skills
            completions = await self.get_user_completed_modules(user_id)
            
            skill_endorsements = self.supabase.table("skill_endorsements").select(
                "skill_name, source_path_id, proficiency_level, endorsed_at"
            ).eq("user_id", user_id).order("endorsed_at", desc=True).execute()

            return {
                "learning_paths": history_response.data or [],
                "completed_modules": completions,
                "skill_endorsements": skill_endorsements.data or [],
                "total_paths": len(history_response.data) if history_response.data else 0,
                "total_skills_learned": len(set(s["skill_name"] for s in (skill_endorsements.data or []))),
            }
        except Exception as e:
            logger.error(f"Error fetching user's learning history: {e}")
            return {
                "learning_paths": [],
                "completed_modules": [],
                "skill_endorsements": [],
                "error": str(e),
            }

    async def filter_modules_for_new_path(
        self,
        user_id: str,
        new_path_modules: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Filter modules for a new learning path, identifying which ones user has already learned."""
        try:
            # Get all completed modules
            completed = await self.get_user_completed_modules(user_id)
            completed_module_ids = {m["module_id"] for m in completed}

            # Check for equivalent modules
            filtered_modules = []
            skippable_modules = []

            for module in new_path_modules:
                module_id = module.get("id")
                
                if module_id in completed_module_ids:
                    # User has completed this exact module
                    skippable_modules.append({
                        "module_id": module_id,
                        "reason": "already_completed",
                        "module_title": module.get("title"),
                    })
                else:
                    # Check if there's an equivalent module in completed modules
                    equivalency = self.supabase.table("module_equivalencies").select(
                        "similarity_score, overlapping_skills"
                    ).or_(
                        f"module_a_id.eq.{module_id},module_b_id.eq.{module_id}"
                    ).execute()

                    if equivalency.data:
                        for equiv in equivalency.data:
                            equiv_module_id = (
                                equiv.get("module_a_id")
                                if equiv.get("module_a_id") != module_id
                                else equiv.get("module_b_id")
                            )
                            if equiv_module_id in completed_module_ids:
                                skippable_modules.append({
                                    "module_id": module_id,
                                    "reason": "equivalent_module_completed",
                                    "module_title": module.get("title"),
                                    "similarity_score": equiv.get("similarity_score"),
                                    "overlapping_skills": equiv.get("overlapping_skills"),
                                })
                                break
                        else:
                            filtered_modules.append(module)
                    else:
                        filtered_modules.append(module)

            return {
                "success": True,
                "filtered_modules": filtered_modules,
                "skippable_modules": skippable_modules,
                "modules_to_study": len(filtered_modules),
                "modules_already_learned": len(skippable_modules),
            }
        except Exception as e:
            logger.error(f"Error filtering modules: {e}")
            return {
                "success": False,
                "error": str(e),
                "filtered_modules": new_path_modules,  # Return original if error
            }

    async def get_roadmap_with_context(
        self,
        user_id: str,
        new_path_id: str,
        new_path_modules: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Generate a personalized roadmap based on user's learning history."""
        try:
            learning_history = await self.get_user_learning_history(user_id)
            filtered = await self.filter_modules_for_new_path(user_id, new_path_modules)

            # Build context prompt for roadmap
            context_prompt = f"""User's learning background:
- Total paths completed: {learning_history['total_paths']}
- Total unique skills learned: {learning_history['total_skills_learned']}
- Previous skills: {', '.join(set(s['skill_name'] for s in learning_history['skill_endorsements'][:10]))}
- Modules already skipped: {len(filtered['skippable_modules'])}

Current path modules to study: {len(filtered['filtered_modules'])}
Modules already learned from this path: {len(filtered['skippable_modules'])}

Provide a personalized learning strategy focusing on:
1. Fresh modules to study
2. How to leverage existing knowledge
3. Recommended learning pace"""

            return {
                "success": True,
                "personalized_roadmap": {
                    "modules": filtered["filtered_modules"],
                    "skippable_modules": filtered["skippable_modules"],
                    "context": context_prompt,
                    "summary": {
                        "total_modules": len(new_path_modules),
                        "modules_to_study": filtered["modules_to_study"],
                        "modules_already_learned": filtered["modules_already_learned"],
                        "estimated_new_content_percentage": (
                            (filtered["modules_to_study"] / len(new_path_modules) * 100)
                            if new_path_modules
                            else 0
                        ),
                    },
                },
            }
        except Exception as e:
            logger.error(f"Error generating roadmap with context: {e}")
            return {"success": False, "error": str(e)}
