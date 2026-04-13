"""Assessment Evaluation Service - Evaluate user responses and calculate scores."""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
from typing import Any

import google.generativeai as genai
from supabase import Client

logger = logging.getLogger(__name__)


class AssessmentEvaluationService:
    """Service for evaluating assessment responses and calculating performance metrics."""

    def __init__(self, supabase_client: Client, google_api_key: str = None, gemini_model: str = "gemini-2.0-flash"):
        self.supabase = supabase_client
        self.gemini_model = gemini_model
        if google_api_key:
            genai.configure(api_key=google_api_key)

    async def evaluate_quiz_answer(
        self,
        question: dict[str, Any],
        user_answer_index: int,
    ) -> dict[str, Any]:
        """Evaluate a multiple-choice quiz answer."""
        try:
            correct_index = question.get("correct_answer_index", -1)
            is_correct = user_answer_index == correct_index
            
            # Basic scoring
            points = 10 if is_correct else 0
            
            return {
                "is_correct": is_correct,
                "points_earned": points,
                "max_points": 10,
                "explanation": question.get("explanation", ""),
                "correct_answer": question.get("options", [])[correct_index] if correct_index >= 0 else None,
            }
        except Exception as e:
            logger.error(f"Error evaluating quiz answer: {e}")
            return {
                "is_correct": False,
                "points_earned": 0,
                "max_points": 10,
                "error": str(e),
            }

    async def evaluate_coding_submission(
        self,
        question: dict[str, Any],
        user_code: str,
    ) -> dict[str, Any]:
        """Evaluate a Python coding submission by running tests."""
        try:
            test_cases = question.get("test_cases", [])
            passed_tests = 0
            total_tests = len(test_cases)
            execution_errors = []
            
            for test_case in test_cases:
                try:
                    # Create a temporary file with user code + test
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                        f.write(user_code)
                        f.write("\n\n# Test execution\n")
                        
                        # Format test case
                        test_input = test_case.get("input", {})
                        expected_output = test_case.get("expected_output", "")
                        
                        if isinstance(test_input, dict) and "args" in test_input:
                            args = test_input["args"]
                            f.write(f"result = solution(*{args})\n")
                        else:
                            f.write(f"result = solution({test_input})\n")
                        
                        f.write(f"assert str(result).strip() == str({json.dumps(expected_output)}).strip()\n")
                        temp_file = f.name
                    
                    # Execute code
                    result = subprocess.run(
                        ["python", temp_file],
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    
                    if result.returncode == 0:
                        passed_tests += 1
                    else:
                        execution_errors.append(result.stderr)
                        
                except subprocess.TimeoutExpired:
                    execution_errors.append("Code execution timed out")
                except Exception as e:
                    execution_errors.append(str(e))
            
            # Calculate score based on tests passed
            test_percentage = (passed_tests / total_tests * 100) if total_tests > 0 else 0
            
            # Score breakdown (from rubric if available)
            rubric = question.get("rubric", {})
            correctness_weight = rubric.get("correctness", 60) / 100
            quality_weight = rubric.get("code_quality", 20) / 100
            efficiency_weight = rubric.get("efficiency", 20) / 100
            
            # Scoring calculation
            correctness_score = test_percentage * correctness_weight
            quality_score = 20 if passed_tests == total_tests else (passed_tests / total_tests * 20) if total_tests > 0 else 0
            efficiency_score = 20 if passed_tests == total_tests else 0
            
            total_score = correctness_score + quality_score + efficiency_score
            points = (total_score / 100) * 20  # Max 20 points for coding
            
            return {
                "is_correct": passed_tests == total_tests,
                "points_earned": round(points, 2),
                "max_points": 20,
                "passed_test_cases": passed_tests,
                "total_test_cases": total_tests,
                "test_percentage": round(test_percentage, 2),
                "execution_output": "\n".join(execution_errors) if execution_errors else "All tests passed",
                "passed": passed_tests == total_tests,
            }
        except Exception as e:
            logger.error(f"Error evaluating coding submission: {e}")
            return {
                "is_correct": False,
                "points_earned": 0,
                "max_points": 20,
                "error": str(e),
            }

    async def evaluate_debugging_submission(
        self,
        question: dict[str, Any],
        user_fixed_code: str,
    ) -> dict[str, Any]:
        """Evaluate a debugging test submission."""
        try:
            test_cases = question.get("test_cases", [])
            passed_tests = 0
            total_tests = len(test_cases)
            execution_errors = []
            
            for test_case in test_cases:
                try:
                    # Execute fixed code with test case
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                        f.write(user_fixed_code)
                        f.write("\n\n# Test execution\n")
                        
                        test_input = test_case.get("input", {})
                        expected_output = test_case.get("expected_output", "")
                        
                        if isinstance(test_input, dict) and "args" in test_input:
                            args = test_input["args"]
                            f.write(f"result = solution(*{args})\n")
                        else:
                            f.write(f"result = solution({test_input})\n")
                        
                        f.write(f"assert str(result).strip() == str({json.dumps(expected_output)}).strip()\n")
                        temp_file = f.name
                    
                    result = subprocess.run(
                        ["python", temp_file],
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    
                    if result.returncode == 0:
                        passed_tests += 1
                    else:
                        execution_errors.append(result.stderr)
                        
                except subprocess.TimeoutExpired:
                    execution_errors.append("Code execution timed out")
                except Exception as e:
                    execution_errors.append(str(e))
            
            test_percentage = (passed_tests / total_tests * 100) if total_tests > 0 else 0
            points = (test_percentage / 100) * 15  # Max 15 points for debugging
            
            return {
                "is_correct": passed_tests == total_tests,
                "points_earned": round(points, 2),
                "max_points": 15,
                "passed_test_cases": passed_tests,
                "total_test_cases": total_tests,
                "test_percentage": round(test_percentage, 2),
                "debugging_quality": "excellent" if passed_tests == total_tests else "partial",
                "passed": passed_tests == total_tests,
            }
        except Exception as e:
            logger.error(f"Error evaluating debugging submission: {e}")
            return {
                "is_correct": False,
                "points_earned": 0,
                "max_points": 15,
                "error": str(e),
            }

    async def calculate_assessment_score(
        self,
        assessment_id: str,
        user_id: str,
        assessment_type: str,
        difficulty: str,
    ) -> dict[str, Any]:
        """Calculate overall assessment score from all responses."""
        try:
            # Get all responses for this assessment
            responses = self.supabase.table("assessment_responses").select(
                "is_correct, points_earned, max_points"
            ).eq("assessment_id", assessment_id).eq("user_id", user_id).execute()
            
            responses_data = responses.data or []
            
            total_points = sum(r.get("points_earned", 0) for r in responses_data)
            max_points = sum(r.get("max_points", 10) for r in responses_data)
            correct_count = sum(1 for r in responses_data if r.get("is_correct"))
            
            score_percentage = (total_points / max_points * 100) if max_points > 0 else 0
            
            # Difficulty-based penalty for failures
            penalty = self._calculate_penalty(difficulty, correct_count, len(responses_data))
            xp_earned = self._calculate_xp(score_percentage, difficulty, len(responses_data))
            
            # Determine performance level
            if score_percentage >= 90:
                performance_level = "expert"
            elif score_percentage >= 75:
                performance_level = "proficient"
            elif score_percentage >= 50:
                performance_level = "developing"
            else:
                performance_level = "beginner"
            
            return {
                "success": True,
                "assessment_id": assessment_id,
                "score": round(score_percentage, 2),
                "total_points": round(total_points, 2),
                "max_points": max_points,
                "correct_answers": correct_count,
                "total_questions": len(responses_data),
                "performance_level": performance_level,
                "xp_earned": xp_earned,
                "penalty_points": penalty,
            }
        except Exception as e:
            logger.error(f"Error calculating assessment score: {e}")
            return {"success": False, "error": str(e)}

    def _calculate_penalty(self, difficulty: str, correct_count: int, total_count: int) -> int:
        """Calculate penalty based on difficulty level and failures."""
        if total_count == 0:
            return 0
        
        incorrect_count = total_count - correct_count
        
        # Higher penalty for easy questions failed
        if difficulty == "easy":
            return incorrect_count * 5  # 5 points penalty per wrong easy question
        elif difficulty == "medium":
            return incorrect_count * 2  # 2 points penalty per wrong medium
        else:  # hard
            return incorrect_count * 1  # 1 point penalty per wrong hard

    def _calculate_xp(self, score_percentage: float, difficulty: str, total_questions: int) -> int:
        """Calculate XP earned from assessment."""
        base_xp = {
            "easy": 50,
            "medium": 100,
            "hard": 200,
        }
        
        multiplier = score_percentage / 100
        xp = int(base_xp.get(difficulty, 100) * multiplier)
        
        # Bonus for perfect score
        if score_percentage == 100:
            xp = int(xp * 1.5)
        
        return xp

    async def identify_failed_skills(
        self,
        assessment_id: str,
        user_id: str,
    ) -> list[dict[str, Any]]:
        """Identify skills that user failed in this assessment."""
        try:
            # Get all questions and responses
            questions = self.supabase.table("assessment_questions").select(
                "id, skill, difficulty"
            ).eq("assessment_id", assessment_id).execute()
            
            responses = self.supabase.table("assessment_responses").select(
                "question_id, is_correct"
            ).eq("assessment_id", assessment_id).eq("user_id", user_id).execute()
            
            questions_data = {q["id"]: q for q in (questions.data or [])}
            responses_data = responses.data or []
            
            failed_skills = []
            for response in responses_data:
                if not response.get("is_correct"):
                    question = questions_data.get(response.get("question_id"))
                    if question:
                        failed_skills.append({
                            "skill": question.get("skill"),
                            "difficulty": question.get("difficulty"),
                            "question_id": response.get("question_id"),
                        })
            
            # Deduplicate by skill
            unique_failed_skills = {}
            for item in failed_skills:
                skill = item["skill"]
                if skill not in unique_failed_skills:
                    unique_failed_skills[skill] = item
            
            return list(unique_failed_skills.values())
        except Exception as e:
            logger.error(f"Error identifying failed skills: {e}")
            return []
