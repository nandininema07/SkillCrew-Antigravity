"""Assessment Generation Service - Generate quiz, coding, and debugging tests based on module content."""

from __future__ import annotations

import json
import logging
from typing import Any

import google.generativeai as genai
from supabase import Client

logger = logging.getLogger(__name__)


class AssessmentGenerationService:
    """Service for generating assessments based on module content and user preferences."""

    def __init__(self, supabase_client: Client, google_api_key: str, gemini_model: str = "gemini-2.0-flash"):
        self.supabase = supabase_client
        self.gemini_model = gemini_model
        genai.configure(api_key=google_api_key)

    async def generate_assessment_questions(
        self,
        module_content: dict[str, Any],
        assessment_type: str,  # 'quiz', 'coding_test', 'debugging_test'
        difficulty: str,  # 'easy', 'medium', 'hard'
        num_questions: int = 3,
        user_preferences: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate assessment questions based on module content."""
        try:
            if assessment_type == "quiz":
                return await self._generate_quiz_questions(
                    module_content, difficulty, num_questions, user_preferences
                )
            elif assessment_type == "coding_test":
                return await self._generate_coding_test(
                    module_content, difficulty, num_questions, user_preferences
                )
            elif assessment_type == "debugging_test":
                return await self._generate_debugging_test(
                    module_content, difficulty, num_questions, user_preferences
                )
            else:
                return {"success": False, "error": f"Unknown assessment type: {assessment_type}"}
        except Exception as e:
            logger.error(f"Error generating assessment questions: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_quiz_questions(
        self,
        module_content: dict[str, Any],
        difficulty: str,
        num_questions: int,
        user_preferences: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate multiple choice quiz questions."""
        try:
            module_title = module_content.get("title", "Unknown Module")
            module_description = module_content.get("description", "")
            skills = module_content.get("skills", [])
            
            difficulty_desc = {
                "easy": "beginner/foundational knowledge",
                "medium": "intermediate concepts and application",
                "hard": "advanced concepts, edge cases, and critical thinking"
            }

            prompt = f"""Generate {num_questions} multiple-choice quiz questions for the following module.

Module Title: {module_title}
Module Description: {module_description}
Skills Covered: {', '.join(skills)}
Difficulty Level: {difficulty} ({difficulty_desc.get(difficulty, '')})

For each question, provide:
1. A clear, unambiguous question text
2. Exactly 4 multiple-choice options
3. The index of the correct answer (0-3)
4. A brief explanation of why the correct answer is right
5. The specific skill being tested

Format as JSON array:
[{{
  "question_text": "...",
  "skill": "...",
  "options": ["option 1", "option 2", "option 3", "option 4"],
  "correct_answer_index": 0,
  "explanation": "...",
  "difficulty": "{difficulty}"
}}]

Ensure questions test understanding, not just memorization. Make them practical and relevant."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                questions = json.loads(json_str)
            else:
                return {"success": False, "error": "Failed to parse AI response"}

            return {
                "success": True,
                "assessment_type": "quiz",
                "difficulty": difficulty,
                "questions": questions,
                "num_questions": len(questions),
            }
        except Exception as e:
            logger.error(f"Error generating quiz questions: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_coding_test(
        self,
        module_content: dict[str, Any],
        difficulty: str,
        num_questions: int,
        user_preferences: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate Python coding test questions."""
        try:
            module_title = module_content.get("title", "Unknown Module")
            module_description = module_content.get("description", "")
            skills = module_content.get("skills", [])

            prompt = f"""Generate {num_questions} small Python coding tests for the module "{module_title}".

Module Description: {module_description}
Skills: {', '.join(skills)}
Difficulty: {difficulty}

For each coding test, provide:
1. A problem statement/description
2. Starter code (if needed)
3. Test cases (input/expected output pairs)
4. Evaluation rubric
5. The skill being tested

The problem should be solvable in 5-15 lines of code for the module level.

Format as JSON array:
[{{
  "problem_description": "...",
  "skill": "...",
  "starter_code": "def solution(...):\n    pass",
  "test_cases": [
    {{"input": {{"args": [...]}}, "expected_output": "..."}},
    ...
  ],
  "rubric": {{
    "correctness": 60,
    "code_quality": 20,
    "efficiency": 20
  }},
  "difficulty": "{difficulty}"
}}]

Make problems practical, testing the actual skill from the module."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                questions = json.loads(json_str)
            else:
                return {"success": False, "error": "Failed to parse AI response"}

            return {
                "success": True,
                "assessment_type": "coding_test",
                "difficulty": difficulty,
                "questions": questions,
                "num_questions": len(questions),
            }
        except Exception as e:
            logger.error(f"Error generating coding test: {e}")
            return {"success": False, "error": str(e)}

    async def _generate_debugging_test(
        self,
        module_content: dict[str, Any],
        difficulty: str,
        num_questions: int,
        user_preferences: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate Python debugging test questions."""
        try:
            module_title = module_content.get("title", "Unknown Module")
            module_description = module_content.get("description", "")
            skills = module_content.get("skills", [])

            prompt = f"""Generate {num_questions} Python debugging tests for the module "{module_title}".

Module Description: {module_description}
Skills: {', '.join(skills)}
Difficulty: {difficulty}

For each debugging test:
1. Provide buggy Python code with ONE or more intentional bugs
2. Describe what the code should do
3. Provide test cases that expose the bugs
4. Indicate what type(s) of bugs are present
5. The skill being tested

The code should be short (10-20 lines) and the bugs should be realistic for the difficulty level.

Format as JSON array:
[{{
  "description": "Fix the bug in this code that should...",
  "skill": "...",
  "buggy_code": "...",
  "test_cases": [
    {{"input": {{"args": [...]}}, "expected_output": "...", "current_output": "..."}},
    ...
  ],
  "bug_types": ["logic error", "off-by-one", ...],
  "expected_fixed_code": "...",
  "difficulty": "{difficulty}"
}}]

Make bugs realistic and educational, not trivial."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                questions = json.loads(json_str)
            else:
                return {"success": False, "error": "Failed to parse AI response"}

            return {
                "success": True,
                "assessment_type": "debugging_test",
                "difficulty": difficulty,
                "questions": questions,
                "num_questions": len(questions),
            }
        except Exception as e:
            logger.error(f"Error generating debugging test: {e}")
            return {"success": False, "error": str(e)}

    async def generate_remedial_questions(
        self,
        failed_skill: str,
        failed_difficulty: str,
        module_content: dict[str, Any],
        num_questions: int = 5,
    ) -> dict[str, Any]:
        """Generate remedial/deep-dive questions for a skill user failed."""
        try:
            prompt = f"""The user failed a {failed_difficulty} question on the skill: {failed_skill}

Module Context: {module_content.get('title', '')}
Description: {module_content.get('description', '')}

Generate {num_questions} progressive remedial questions to help the user master this skill.
Start with foundational concepts and build up gradually.

Format as JSON array with quiz questions that build understanding:
[{{
  "question_text": "...",
  "skill": "{failed_skill}",
  "options": ["option 1", "option 2", "option 3", "option 4"],
  "correct_answer_index": 0,
  "explanation": "...",
  "difficulty": "easy" or "medium"
}}]

Each question should explain the concept in detail after answering."""

            model = genai.GenerativeModel(self.gemini_model)
            response = model.generate_content(prompt)
            
            response_text = response.text
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                questions = json.loads(json_str)
            else:
                return {"success": False, "error": "Failed to parse AI response"}

            return {
                "success": True,
                "is_remedial": True,
                "failed_skill": failed_skill,
                "questions": questions,
                "num_questions": len(questions),
            }
        except Exception as e:
            logger.error(f"Error generating remedial questions: {e}")
            return {"success": False, "error": str(e)}
