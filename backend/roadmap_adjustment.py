"""Roadmap Adjustment Service - Dynamically adjust roadmaps based on assessment performance."""

from __future__ import annotations

import json
import logging
from typing import Any

import google.generativeai as genai
from supabase import Client

logger = logging.getLogger(__name__)


class RoadmapAdjustmentService:
    """Service for dynamically adjusting roadmaps based on user performance."""

    def __init__(self, supabase_client: Client, google_api_key: str, gemini_model: str = "gemini-2.0-flash"):
        self.supabase = supabase_client
        self.gemini_model = gemini_model
        genai.configure(api_key=google_api_key)

    async def trigger_deep_dive_insertion(
        self,
        user_id: str,
        roadmap_id: str,
        failed_skill: str,
        failed_difficulty: str,
        assessment_id: str,
        module_content: dict[str, Any],
    ) -> dict[str, Any]:
        """Create and insert a deep-dive module for a failed topic."""
        try:
            # Generate deep-dive module content
            deep_dive = await self._generate_deep_dive_module(
                failed_skill, failed_difficulty, module_content
            )
            
            if not deep_dive.get("success"):
                return {"success": False, "error": "Failed to generate deep-dive module"}
            
            # Store adjustment in database
            adjustment_data = {
                "user_id": user_id,
                "roadmap_id": roadmap_id,
                "trigger_assessment_id": assessment_id,
                "trigger_skill": failed_skill,
                "trigger_difficulty": failed_difficulty,
                "adjustment_type": "deep_dive_module",
                "adjustment_content": {
                    "module_title": deep_dive.get("title"),
                    "description": deep_dive.get("description"),
                    "learning_objectives": deep_dive.get("learning_objectives"),
                    "content_sections": deep_dive.get("content_sections"),
                    "resources": deep_dive.get("resources"),
                    "estimated_duration_minutes": deep_dive.get("estimated_duration_minutes"),
                    "related_skill": failed_skill,
                },
                "is_active": True,
            }
            
            response = self.supabase.table("roadmap_dynamic_adjustments").insert(
                adjustment_data
            ).execute()
            
            adjustment_id = response.data[0]["id"] if response.data else None
            
            return {
                "success": True,
                "adjustment_id": adjustment_id,
                "deep_dive_module": deep_dive,
                "message": f"Deep-dive module added for '{failed_skill}' skill"
            }
        except Exception as e:
            logger.error(f"Error triggering deep-dive insertion: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_deep_dive_module(
        self,
        failed_skill: str,
        difficulty: str,
        context_module: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate a comprehensive deep-dive module for a failed skill."""
        try:
            context_title = context_module.get("title", "")
            context_desc = context_module.get("description", "")
            
            prompt = f"""Create a comprehensive "Deep Dive" learning module to help a user master the skill: {failed_skill}

Context: This module should cover the skill in depth after the user struggled with it while learning about "{context_title}".

The user struggled at the "{difficulty}" difficulty level, so create content that:
1. Starts with clear foundational concepts
2. Provides multiple examples and explanations
3. Includes practical applications
4. Builds to more complex applications

Provide the module structure in JSON format:
{{
  "title": "Deep Dive: [Skill Name]",
  "description": "...",
  "learning_objectives": [
    "Understand...",
    "Apply...",
    "Analyze..."
  ],
  "content_sections": [
    {{
      "section_title": "Foundation",
      "description": "...",
      "key_concepts": ["concept1", "concept2"],
      "explanation": "..."
    }},
    {{
      "section_title": "Practical Examples",
      "description": "...",
      "examples": [
        {{
          "title": "Example 1",
          "explanation": "...",
          "code_or_demo": "..."
        }}
      ]
    }},
    {{
      "section_title": "Common Mistakes",
      "description": "...",
      "mistakes": [
        {{
          "mistake_type": "...",
          "explanation": "...",
          "how_to_avoid": "..."
        }}
      ]
    }},
    {{
      "section_title": "Advanced Applications",
      "description": "...",
      "applications": ["application 1", "application 2"]
    }}
  ],
  "resources": [
    {{
      "type": "article|video|documentation|interactive",
      "title": "...",
      "url": "...",
      "description": "..."
    }}
  ],
  "estimated_duration_minutes": 45,
  "difficulty_progression": ["beginner", "intermediate", "advanced"]
}}

Ensure the module is comprehensive yet digestible, with clear progression from basics to advanced concepts."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                module_content = json.loads(json_str)
                module_content["success"] = True
                return module_content
            else:
                return {"success": False, "error": "Failed to parse AI response"}
                
        except Exception as e:
            logger.error(f"Error generating deep-dive module: {e}")
            return {"success": False, "error": str(e)}

    async def generate_remedial_content(
        self,
        failed_skill: str,
        num_resources: int = 5,
    ) -> dict[str, Any]:
        """Generate remedial resources for a failed skill."""
        try:
            prompt = f"""Suggest {num_resources} high-quality learning resources to help someone master the skill: {failed_skill}

Include a mix of:
- Articles (conceptual explanations)
- Video tutorials (visual learning)
- Interactive tutorials (hands-on)
- Documentation (reference)
- Books/Courses (comprehensive)

Format as JSON:
{{
  "skill": "{failed_skill}",
  "remedial_resources": [
    {{
      "type": "article|video|interactive|documentation|book",
      "title": "...",
      "url": "...",
      "estimated_time_minutes": 30,
      "difficulty_level": "beginner|intermediate|advanced",
      "why_recommended": "..."
    }}
  ],
  "learning_sequence": ["Resource 1 title", "Resource 2 title", ...],
  "estimated_total_time_hours": 3
}}

Make sure resources are real (you can use placeholder URLs like https://example.com for now)."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                resources = json.loads(json_str)
                return {"success": True, **resources}
            else:
                return {"success": False, "error": "Failed to parse AI response"}
                
        except Exception as e:
            logger.error(f"Error generating remedial content: {e}")
            return {"success": False, "error": str(e)}

    async def check_and_adjust_roadmap(
        self,
        user_id: str,
        roadmap_id: str,
        failed_skills: list[dict[str, Any]],
        assessment_id: str,
        module_content: dict[str, Any],
    ) -> dict[str, Any]:
        """Check if roadmap needs adjustment based on failed skills."""
        try:
            if not failed_skills:
                return {
                    "success": True,
                    "roadmap_adjusted": False,
                    "message": "No failed skills to address"
                }
            
            adjustments = []
            
            for failed_item in failed_skills:
                failed_skill = failed_item.get("skill")
                failed_difficulty = failed_item.get("difficulty")
                
                # Only trigger deep-dive for easy questions failed
                if failed_difficulty == "easy":
                    adjustment = await self.trigger_deep_dive_insertion(
                        user_id=user_id,
                        roadmap_id=roadmap_id,
                        failed_skill=failed_skill,
                        failed_difficulty=failed_difficulty,
                        assessment_id=assessment_id,
                        module_content=module_content,
                    )
                    
                    if adjustment.get("success"):
                        adjustments.append(adjustment)
            
            return {
                "success": True,
                "roadmap_adjusted": len(adjustments) > 0,
                "adjustments_made": len(adjustments),
                "adjustment_details": adjustments,
                "message": f"{len(adjustments)} deep-dive module(s) added to roadmap"
            }
        except Exception as e:
            logger.error(f"Error checking and adjusting roadmap: {e}")
            return {"success": False, "error": str(e)}

    async def get_active_adjustments(
        self,
        user_id: str,
        roadmap_id: str,
    ) -> dict[str, Any]:
        """Get all active dynamic adjustments for a roadmap."""
        try:
            response = self.supabase.table("roadmap_dynamic_adjustments").select(
                "id, trigger_skill, adjustment_type, adjustment_content, created_at"
            ).eq("user_id", user_id).eq("roadmap_id", roadmap_id).eq("is_active", True).execute()
            
            adjustments = response.data or []
            
            return {
                "success": True,
                "total_adjustments": len(adjustments),
                "adjustments": adjustments,
            }
        except Exception as e:
            logger.error(f"Error getting active adjustments: {e}")
            return {"success": False, "error": str(e)}
