"""Assessment API Endpoints - Handle assessment generation, submission, and evaluation."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from assessment_generation import AssessmentGenerationService
from assessment_evaluation import AssessmentEvaluationService
from roadmap_adjustment import RoadmapAdjustmentService
from learning_continuity import LearningContinuityService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

# Will be initialized in main.py
assessment_generation_service: AssessmentGenerationService | None = None
assessment_evaluation_service: AssessmentEvaluationService | None = None
roadmap_adjustment_service: RoadmapAdjustmentService | None = None
learning_continuity_service: LearningContinuityService | None = None


class GenerateAssessmentRequest(BaseModel):
    """Request to generate assessment questions."""
    roadmap_id: str
    module_ids: list[str]
    assessment_type: str  # 'quiz', 'coding_test', 'debugging_test'
    difficulty: str  # 'easy', 'medium', 'hard'
    num_questions: int = 3
    module_content: dict[str, Any]
    user_preferences: dict[str, Any] | None = None


class SubmitAnswerRequest(BaseModel):
    """Request to submit an answer."""
    assessment_id: str
    question_id: str
    user_answer: str
    time_spent_seconds: int | None = None


class SubmitCodeRequest(BaseModel):
    """Request to submit code for coding/debugging test."""
    assessment_id: str
    question_id: str
    code: str
    time_spent_seconds: int | None = None


class AssessmentCompleteRequest(BaseModel):
    """Request when assessment is complete."""
    assessment_id: str
    assessment_type: str
    difficulty: str
    total_time_seconds: int | None = None


@router.post("/generate")
async def generate_assessment(
    request: GenerateAssessmentRequest,
    user_id: str = Depends(lambda: None),  # Would be filled by auth middleware
):
    """Generate assessment questions for modules."""
    if not assessment_generation_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        # Generate questions
        result = await assessment_generation_service.generate_assessment_questions(
            module_content=request.module_content,
            assessment_type=request.assessment_type,
            difficulty=request.difficulty,
            num_questions=request.num_questions,
            user_preferences=request.user_preferences,
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=502, detail=result.get("error", "Generation failed"))
        
        # Create assessment record in database
        # This would normally require user_id from auth
        assessment_data = {
            "id": str(uuid.uuid4()),
            "roadmap_id": request.roadmap_id,
            "module_ids": request.module_ids,
            "assessment_type": request.assessment_type,
            "difficulty": request.difficulty,
            "title": f"{request.assessment_type.replace('_', ' ').title()} - {request.difficulty.capitalize()}",
            "skills_tested": request.module_content.get("skills", []),
            "status": "ready",
        }
        
        return {
            "success": True,
            "assessment": assessment_data,
            "questions": result.get("questions", []),
            "num_questions": result.get("num_questions", 0),
        }
    except Exception as e:
        logger.error(f"Error generating assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit-answer")
async def submit_answer(request: SubmitAnswerRequest):
    """Submit a quiz answer."""
    if not assessment_evaluation_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        # Get the question from DB
        # In real implementation, would fetch from DB
        
        # For now, return evaluation result structure
        return {
            "success": True,
            "is_correct": True,
            "points_earned": 10,
            "max_points": 10,
            "feedback": "Correct answer!"
        }
    except Exception as e:
        logger.error(f"Error submitting answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit-code")
async def submit_code(request: SubmitCodeRequest):
    """Submit code for coding or debugging test."""
    if not assessment_evaluation_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        # Evaluate the submission
        # This is a placeholder - actual implementation would fetch question and evaluate
        
        return {
            "success": True,
            "is_correct": True,
            "points_earned": 15,
            "max_points": 20,
            "feedback": "Great job! All tests passed.",
            "test_results": {
                "passed": 5,
                "total": 5,
            }
        }
    except Exception as e:
        logger.error(f"Error evaluating code: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete")
async def complete_assessment(request: AssessmentCompleteRequest):
    """Mark assessment as complete and trigger scoring."""
    if not assessment_evaluation_service or not roadmap_adjustment_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        # Calculate score
        score_result = await assessment_evaluation_service.calculate_assessment_score(
            assessment_id=request.assessment_id,
            user_id="temp_user_id",  # Would come from auth
            assessment_type=request.assessment_type,
            difficulty=request.difficulty,
        )
        
        if not score_result.get("success"):
            raise HTTPException(status_code=500, detail=score_result.get("error"))
        
        # Get failed skills if any
        failed_skills = await assessment_evaluation_service.identify_failed_skills(
            assessment_id=request.assessment_id,
            user_id="temp_user_id",
        )
        
        # Check for roadmap adjustments
        adjustment_result = {}
        if failed_skills:
            adjustment_result = await roadmap_adjustment_service.check_and_adjust_roadmap(
                user_id="temp_user_id",
                roadmap_id="temp_roadmap_id",
                failed_skills=failed_skills,
                assessment_id=request.assessment_id,
                module_content={},
            )
        
        return {
            "success": True,
            "score": score_result.get("score"),
            "xp_earned": score_result.get("xp_earned", 0),
            "performance_level": score_result.get("performance_level"),
            "penalties": score_result.get("penalty_points", 0),
            "roadmap_adjusted": adjustment_result.get("roadmap_adjusted", False),
            "deep_dive_modules": adjustment_result.get("adjustment_details", []),
        }
    except Exception as e:
        logger.error(f"Error completing assessment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/performance/{user_id}")
async def get_user_performance(user_id: str):
    """Get user's overall assessment performance."""
    if not assessment_evaluation_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        # Would fetch from skill_proficiency_tracking table
        return {
            "success": True,
            "user_id": user_id,
            "overall_score": 85.5,
            "total_assessments": 5,
            "passed_assessments": 4,
            "xp_earned": 450,
            "mastered_skills": ["Python Basics", "Functions"],
            "developing_skills": ["Decorators"],
        }
    except Exception as e:
        logger.error(f"Error fetching performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roadmap/{roadmap_id}/adjustments")
async def get_roadmap_adjustments(roadmap_id: str, user_id: str):
    """Get all dynamic adjustments for a roadmap."""
    if not roadmap_adjustment_service:
        raise HTTPException(status_code=503, detail="Assessment service not initialized")
    
    try:
        result = await roadmap_adjustment_service.get_active_adjustments(
            user_id=user_id,
            roadmap_id=roadmap_id,
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        return result
    except Exception as e:
        logger.error(f"Error fetching adjustments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def init_assessment_services(
    supabase_client: Any,
    google_api_key: str,
    gemini_model: str = "gemini-2.0-flash",
):
    """Initialize assessment services."""
    global assessment_generation_service, assessment_evaluation_service, roadmap_adjustment_service
    
    assessment_generation_service = AssessmentGenerationService(
        supabase_client=supabase_client,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
    )
    assessment_evaluation_service = AssessmentEvaluationService(
        supabase_client=supabase_client,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
    )
    roadmap_adjustment_service = RoadmapAdjustmentService(
        supabase_client=supabase_client,
        google_api_key=google_api_key,
        gemini_model=gemini_model,
    )
    
    logger.info("Assessment services initialized")
