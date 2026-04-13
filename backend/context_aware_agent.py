"""Nova Agent Integration for Learning Continuity - Context-aware roadmap generation."""

from __future__ import annotations

import logging
from typing import Any

import google.generativeai as genai

from nova_agent import syllabus_for_prompt

logger = logging.getLogger(__name__)


class ContextAwareNovaAgent:
    """Nova Agent that leverages user's learning history for intelligent roadmap generation."""

    def __init__(self, google_api_key: str, gemini_model: str = "gemini-2.0-flash"):
        self.gemini_model = gemini_model
        genai.configure(api_key=google_api_key)

    @staticmethod
    def _syllabus_section(syllabus_source_text: str | None) -> str:
        trimmed = syllabus_for_prompt(syllabus_source_text, max_chars=12000)
        if not trimmed:
            return ""
        return (
            "\n\nCOURSE / SYLLABUS MATERIAL (user-provided PDF extract; align sequencing and emphasis when relevant):\n"
            + trimmed
            + "\n"
        )

    async def generate_contextual_roadmap(
        self,
        user_profile: dict[str, Any],
        target_path: str,
        learning_history: dict[str, Any],
        available_modules: list[dict[str, Any]],
        filtered_modules: list[dict[str, Any]],
        skippable_modules: list[dict[str, Any]],
        syllabus_source_text: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate a personalized learning roadmap using Nova multi-agent approach.
        
        This integrates user's historical learning context to:
        1. Identify transferable knowledge from previous paths
        2. Suggest module sequencing based on skill prerequisites
        3. Highlight knowledge bridges between paths
        4. Customize pacing and depth based on past performance
        """
        try:
            # Build contextual prompt
            previous_paths = learning_history.get("learning_paths", [])
            previous_skills = [
                s["skill_name"]
                for s in learning_history.get("skill_endorsements", [])[:20]
            ]
            previous_paths_str = ", ".join(
                [p.get("path_id", "N/A") for p in previous_paths[:5]]
            )

            context_for_agent = f"""
LEARNER PROFILE:
- Current Target Path: {target_path}
- Previous Learning Paths: {previous_paths_str if previous_paths_str else "None (new learner)"}
- Total Unique Skills: {learning_history.get('total_skills_learned', 0)}
- Previous Skills: {', '.join(previous_skills) if previous_skills else 'None'}

MODULES IN THIS PATH:
Total: {len(available_modules)}
Already Learned (Skippable): {len(skippable_modules)}
New Content to Learn: {len(filtered_modules)}

SKIPPABLE MODULES (Already Learned):
{self._format_modules_list(skippable_modules[:5])}

NEW MODULES TO LEARN:
{self._format_modules_list(filtered_modules)}

TASK:
Generate a personalized learning roadmap that:
1. Prioritizes NEW modules the learner hasn't encountered
2. Suggests how to leverage previous knowledge from {previous_paths_str or 'similar domains'}
3. Identifies knowledge bridges between previous and current learning
4. Recommends optimal sequencing considering prerequisites
5. Highlights efficiency gains from transferred knowledge"""
            context_for_agent += self._syllabus_section(syllabus_source_text)

            prompt = f"""You are Nova, an intelligent learning path advisor. 
Analyze this learner's background and generate a personalized roadmap.

{context_for_agent}

Provide:
1. ROADMAP_SEQUENCE: Ordered list of modules to study (prioritize new content)
2. KNOWLEDGE_BRIDGES: How previous skills apply to new modules
3. LEARNING_STRATEGY: Customized pacing and approach
4. EFFICIENCY_BOOST: Estimated % reduction in learning time due to transferred knowledge
5. PREREQUISITE_NOTES: Any prerequisites from skipped modules that matter

Format as clear sections with bullet points."""

            model = genai.GenerativeModel(
                self.gemini_model,
                system_instruction="You are Nova, an expert learning path advisor who helps learners efficiently progress through multiple learning paths by leveraging their previous knowledge.",
            )
            
            response = model.generate_content(prompt)
            response_text = response.text

            return {
                "success": True,
                "contextual_roadmap": response_text,
                "summary": {
                    "target_path": target_path,
                    "new_modules_to_learn": len(filtered_modules),
                    "modules_already_learned": len(skippable_modules),
                    "total_modules": len(available_modules),
                    "learning_efficiency_boost": self._estimate_efficiency_boost(
                        previous_skills, filtered_modules
                    ),
                },
                "modules_sequence": self._extract_module_sequence(
                    response_text, filtered_modules
                ),
            }
        except Exception as e:
            logger.error(f"Error generating contextual roadmap: {e}")
            return {
                "success": False,
                "error": str(e),
                "contextual_roadmap": "Unable to generate personalized roadmap",
            }

    async def suggest_learning_focus(
        self,
        user_id: str,
        candidate_paths: list[dict[str, Any]],
        learning_history: dict[str, Any],
        user_skills: list[str],
        syllabus_source_text: str | None = None,
    ) -> dict[str, Any]:
        """
        Use Nova agent to intelligently suggest which learning path to pursue next.
        Considers:
        - User's completed paths and skills
        - Natural progression and skill synergies
        - Interest/goal alignment
        - Optimal skill-stacking order
        """
        try:
            previous_paths = ", ".join(
                [p.get("path_id", "N/A") for p in learning_history.get("learning_paths", [])[:3]]
            )

            syllabus_block = self._syllabus_section(syllabus_source_text)

            prompt = f"""You are Nova, a career pathfinding advisor.
            
LEARNER BACKGROUND:
- Completed Paths: {previous_paths if previous_paths else "None (new learner)"}
- Current Skills: {', '.join(user_skills) if user_skills else "Unknown"}
- Total Hours Invested: {sum(p.get('total_hours', 0) for p in learning_history.get('learning_paths', [])) or 'Unknown'}
{syllabus_block}
AVAILABLE NEXT PATHS:
{self._format_paths_list(candidate_paths)}

TASK:
Recommend the single best next learning path based on:
1. Natural skill progression from their background
2. Market demand and career value
3. Leveraging existing knowledge to accelerate learning
4. Preventing skill redundancy

Provide:
- TOP_RECOMMENDATION: Best path to pursue next
- WHY: 3-4 clear reasons
- SKILL_ALIGNMENT: How current skills transfer
- ESTIMATED_ACCELERATION: % faster learning due to background
- ALTERNATIVE_PATHS: 2 other good options"""

            model = genai.GenerativeModel(
                self.gemini_model,
                system_instruction="You are Nova, an expert learning advisor with deep knowledge of skill synergies and career progression.",
            )
            
            response = model.generate_content(prompt)

            return {
                "success": True,
                "recommendations": response.text,
                "candidate_paths": candidate_paths,
            }
        except Exception as e:
            logger.error(f"Error suggesting learning focus: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def _format_modules_list(modules: list[dict[str, Any]], limit: int = 10) -> str:
        """Format module list for prompt."""
        items = []
        for i, mod in enumerate(modules[:limit], 1):
            title = mod.get("title", "Unknown")
            skills = ", ".join(mod.get("skills", [])[:3])
            items.append(f"{i}. {title} (Skills: {skills})")
        return "\n".join(items) or "None"

    @staticmethod
    def _format_paths_list(paths: list[dict[str, Any]]) -> str:
        """Format paths list for prompt."""
        items = []
        for i, path in enumerate(paths, 1):
            name = path.get("title", "Unknown")
            goal = path.get("goal", "Unknown")
            items.append(f"{i}. {name} (Goal: {goal})")
        return "\n".join(items) or "None"

    @staticmethod
    def _estimate_efficiency_boost(previous_skills: list[str], new_modules: list[dict[str, Any]]) -> float:
        """Estimate % learning time reduction due to transferred knowledge."""
        if not previous_skills or not new_modules:
            return 0.0

        # Count skill overlaps
        new_module_skills = set()
        for mod in new_modules:
            new_module_skills.update(mod.get("skills", []))

        previous_skill_set = set(s.lower() for s in previous_skills)
        overlap_count = sum(
            1 for skill in new_module_skills
            if skill.lower() in previous_skill_set
        )

        # Estimate 10% reduction per overlapping skill (max 40%)
        efficiency = min(overlap_count * 0.10, 0.40)
        return round(efficiency * 100, 1)

    @staticmethod
    def _extract_module_sequence(
        agent_response: str,
        modules: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Extract suggested module sequence from agent response (best effort)."""
        # Simple heuristic: look for modules mentioned in response order
        sequence = []
        seen_modules = set()

        for line in agent_response.split("\n"):
            for module in modules:
                module_title = module.get("title", "").lower()
                if (
                    module_title
                    and module_title in line.lower()
                    and module.get("id") not in seen_modules
                ):
                    sequence.append(module)
                    seen_modules.add(module.get("id"))
                    break

        # If no sequencing found, return modules as-is
        if not sequence:
            sequence = modules

        return sequence
