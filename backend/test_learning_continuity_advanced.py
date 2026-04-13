"""Advanced learning continuity tests: cross-path detection, equivalency, and multi-user scenarios."""

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE_URL = "http://127.0.0.1:8000"

# Test users from Supabase auth (real users)
TEST_USERS = {
    "atharva_sawant": "7580ebd2-ed5f-4231-82e3-0f53d6d7ed77",
    "gargee_sowani": "481f88a9-5553-4fd5-975c-fe139137ac74",
    "nandini_nema": "3bf4e501-f3a8-40d5-b934-283773628f3b",
    "parv_siria": "45b6efaa-5c98-45a5-8b34-f377e3a6bab4",
}

# Existing learning modules (from DB)
MODULES = {
    "python_ml": "550e8400-e29b-41d4-a716-446655440010",
    "ml_apis": "550e8400-e29b-41d4-a716-446655440011",
    "deep_learning": "550e8400-e29b-41d4-a716-446655440012",
    "sql_basics": "550e8400-e29b-41d4-a716-446655440001",
    "api_design": "550e8400-e29b-41d4-a716-446655440002",
    "databases": "550e8400-e29b-41d4-a716-446655440003",
}

PATHS = {
    "data_foundation": "11111111-1111-1111-1111-111111111111",
    "ml_journey": "22222222-2222-2222-2222-222222222222",
}


def _post(path, data):
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except Exception as exc:
        return None, str(exc)


def _get(path):
    try:
        with urllib.request.urlopen(f"{BASE_URL}{path}", timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except Exception as exc:
        return None, str(exc)


def test_multi_user_learning_paths():
    """Test: Different users with different learning histories and recommendations."""
    print("\n" + "="*70)
    print("TEST: Multi-User Learning Path Analysis")
    print("="*70)
    
    for user_name, user_id in TEST_USERS.items():
        print(f"\n>>> Testing user: {user_name}")
        print(f"    User ID: {user_id}")
        
        # Get learning history
        status, body = _get(f"/api/learning-history/{user_id}")
        if status == 200:
            resp = json.loads(body)
            completed = len(resp.get("completed_modules", []))
            skills = resp.get("total_skills_learned", 0)
            print(f"    ✓ Completed modules: {completed}")
            print(f"    ✓ Unique skills: {skills}")
            
            if completed > 0:
                # If user has history, test cross-path detection
                modules = [
                    {
                        "id": MODULES["python_ml"],
                        "title": "Python for ML",
                        "skills": ["Python", "NumPy", "Pandas"],
                    },
                    {
                        "id": MODULES["ml_apis"],
                        "title": "Building ML APIs",
                        "skills": ["REST", "API", "FastAPI", "ML"],
                    },
                ]
                
                status, body = _post(
                    "/api/filter-modules",
                    {
                        "user_id": user_id,
                        "modules_data": json.dumps(modules),
                    },
                )
                
                if status == 200:
                    resp = json.loads(body)
                    skipped = resp.get("modules_already_learned", 0)
                    to_study = resp.get("modules_to_study", 0)
                    print(f"    ✓ Can skip (already learned): {skipped}")
                    print(f"    ✓ Need to study: {to_study}")
        else:
            print(f"    ✗ Error fetching history: {status}")


def test_personalized_recommendation_per_user():
    """Test: Generate personalized roadmaps for each user."""
    print("\n" + "="*70)
    print("TEST: Personalized Roadmap Per User")
    print("="*70)
    
    for user_name, user_id in TEST_USERS.items():
        print(f"\n>>> Generating roadmap for {user_name}...")
        
        status, body = _post(
            "/api/agent/generate-contextual-roadmap",
            {
                "user_id": user_id,
                "target_path": PATHS["ml_journey"],
                "user_profile_data": json.dumps({
                    "completed_paths": 1,
                    "skills": ["Learning", "Problem-solving"],
                }),
                "available_modules_data": json.dumps([
                    {
                        "id": MODULES["python_ml"],
                        "title": "Python for ML",
                        "skills": ["Python", "NumPy", "Pandas"],
                    },
                    {
                        "id": MODULES["ml_apis"],
                        "title": "Building ML APIs",
                        "skills": ["REST", "API", "FastAPI", "ML"],
                    },
                    {
                        "id": MODULES["deep_learning"],
                        "title": "Deep Learning",
                        "skills": ["TensorFlow", "Neural Networks"],
                    },
                ]),
            },
        )
        
        if status == 200:
            resp = json.loads(body)
            if resp.get("success"):
                summary = resp.get("summary", {})
                modules_count = summary.get("new_modules_to_learn", 0)
                print(f"    ✓ Roadmap generated")
                print(f"    ✓ Modules to learn: {modules_count}")
            else:
                print(f"    ✗ Roadmap generation failed")
        else:
            print(f"    ✗ Error: {status}")


def test_record_completion_for_user():
    """Test: Record module completions for a user and verify tracking."""
    print("\n" + "="*70)
    print("TEST: Record Completion & Skill Tracking")
    print("="*70)
    
    # Use Atharva Sawant as test subject
    user = TEST_USERS["atharva_sawant"]
    
    print(f"\n>>> Recording new module completion for {user}...")
    
    status, body = _post(
        "/api/record-completion",
        {
            "user_id": user,
            "module_id": MODULES["deep_learning"],
            "path_id": PATHS["ml_journey"],
            "time_spent_minutes": "180",
            "performance_score": "92",
            "skills_acquired": json.dumps(["TensorFlow", "Neural Networks", "Deep Learning"]),
        },
    )
    
    resp = json.loads(body)
    if resp.get("success"):
        print(f"    ✓ Completion recorded: {resp.get('completion_id')}")
        
        # Verify in learning history
        status, body = _get(f"/api/learning-history/{user}")
        resp = json.loads(body)
        total_modules = len(resp.get("completed_modules", []))
        total_skills = resp.get("total_skills_learned", 0)
        
        print(f"    ✓ Updated history - Total modules: {total_modules}")
        print(f"    ✓ Total unique skills: {total_skills}")
    else:
        error = resp.get("error", "Unknown error")
        print(f"    ✗ Failed: {error}")



def test_contextual_recommendation_with_history():
    """Test: Nova agent provides targeted recommendations based on learning history."""
    print("\n" + "="*70)
    print("TEST 2: Contextual Recommendation with Learning History")
    print("="*70)
    
    user = TEST_USERS["database_expert"]
    
    print("\n1. Generating contextual roadmap based on user's background...")
    status, body = _post(
        "/api/agent/generate-contextual-roadmap",
        {
            "user_id": user,
            "target_path": PATHS["ml_journey"],
            "user_profile_data": json.dumps({
                "completed_paths": 1,
                "skills": ["SQL", "PostgreSQL", "Database Design"],
            }),
            "available_modules_data": json.dumps([
                {
                    "id": MODULES["python_ml"],
                    "title": "Python for ML",
                    "skills": ["Python", "NumPy", "Pandas"],
                },
                {
                    "id": MODULES["ml_apis"],
                    "title": "Building ML APIs",
                    "skills": ["REST", "API", "FastAPI", "ML"],
                },
                {
                    "id": MODULES["deep_learning"],
                    "title": "Deep Learning",
                    "skills": ["TensorFlow", "Neural Networks"],
                },
            ]),
        },
    )
    resp = json.loads(body)
    print(f"   Status: {status}")
    print(f"   Success: {resp.get('success', False)}")
    print(f"   Modules in roadmap: {len(resp.get('modules_sequence', []))}")
    
    if resp.get("contextual_roadmap"):
        roadmap_lines = resp["contextual_roadmap"].split("\n")
        print(f"\n   Roadmap summary (first 3 lines):")
        for line in roadmap_lines[:3]:
            if line.strip():
                print(f"   {line}")


def test_skill_tracking_across_paths():
    """Test: Skills are tracked and endorsed across multiple learning paths."""
    print("\n" + "="*70)
    print("TEST 3: Skill Tracking Across Paths")
    print("="*70)
    
    user = TEST_USERS["database_expert"]
    
    print("\n1. Recording new module completion with skills...")
    status, body = _post(
        "/api/record-completion",
        {
            "user_id": user,
            "module_id": MODULES["ml_apis"],
            "path_id": PATHS["ml_journey"],
            "time_spent_minutes": "120",
            "performance_score": "88",
            "skills_acquired": json.dumps(["FastAPI", "REST API", "API Design"]),
        },
    )
    resp = json.loads(body)
    print(f"   Status: {status}")
    print(f"   Success: {resp.get('success', False)}")
    if resp.get("completion_id"):
        print(f"   Completion ID: {resp['completion_id']}")
    
    print("\n2. Checking updated learning history...")
    status, body = _get(f"/api/learning-history/{user}")
    resp = json.loads(body)
    print(f"   Status: {status}")
    print(f"   Total modules completed: {len(resp.get('completed_modules', []))}")
    print(f"   Total unique skills: {resp.get('total_skills_learned', 0)}")
    
    skill_names = [s["skill_name"] for s in resp.get("skill_endorsements", [])]
    print(f"   Recent skills: {skill_names[:5]}")


def test_module_equivalency():
    """Test: Detect if two modules teach similar content (AI-powered)."""
    print("\n" + "="*70)
    print("TEST 4: Module Equivalency Detection")
    print("="*70)
    
    print("\n1. Detecting equivalency between similar modules...")
    status, body = _post(
        "/api/detect-equivalencies",
        {
            "module_a_id": MODULES["ml_apis"],
            "module_a_data": json.dumps({
                "title": "Building ML APIs",
                "description": "Learn to build REST APIs for machine learning models using FastAPI",
                "skills": ["REST", "API", "FastAPI", "ML"],
            }),
            "module_b_id": MODULES["api_design"],
            "module_b_data": json.dumps({
                "title": "Modern API Design",
                "description": "Learn REST API design principles and FastAPI framework",
                "skills": ["REST", "API", "FastAPI", "Design"],
            }),
        },
    )
    resp = json.loads(body)
    print(f"   Status: {status}")
    print(f"   Success: {resp.get('success', False)}")
    print(f"   Similarity score: {resp.get('similarity_score', 0)}")
    print(f"   Is equivalent: {resp.get('is_equivalent', False)}")
    if resp.get("overlapping_skills"):
        print(f"   Overlapping skills: {resp['overlapping_skills']}")


def test_personalized_roadmap():
    """Test: Generate a roadmap personalized by learning history."""
    print("\n" + "="*70)
    print("TEST 5: Personalized Roadmap Generation")
    print("="*70)
    
    user = TEST_USERS["database_expert"]
    
    print("\n1. Generating personalized roadmap for ML path...")
    status, body = _post(
        "/api/personalized-roadmap",
        {
            "user_id": user,
            "path_id": PATHS["ml_journey"],
            "modules_data": json.dumps([
                {
                    "id": MODULES["python_ml"],
                    "title": "Python for ML",
                    "skills": ["Python", "NumPy", "Pandas"],
                },
                {
                    "id": MODULES["ml_apis"],
                    "title": "Building ML APIs",
                    "skills": ["REST", "API", "FastAPI", "ML"],
                },
                {
                    "id": MODULES["deep_learning"],
                    "title": "Deep Learning",
                    "skills": ["TensorFlow", "Neural Networks"],
                },
            ]),
        },
    )
    resp = json.loads(body)
    print(f"   Status: {status}")
    print(f"   Success: {resp.get('success', False)}")
    if resp.get("roadmap_summary"):
        print(f"   Roadmap summary: {resp['roadmap_summary'][:200]}...")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("LEARNING CONTINUITY: REAL USER TEST SUITE")
    print("Testing with 4 existing Supabase users")
    print("="*70)
    
    test_multi_user_learning_paths()
    test_personalized_recommendation_per_user()
    test_record_completion_for_user()
    
    # Optional: Run the advanced tests only if needed
    print("\n" + "="*70)
    print("OPTIONAL: Advanced Equivalency & Roadmap Tests")
    print("="*70)
    
    # Uncomment to run:
    # test_module_equivalency()
    # test_personalized_roadmap()
    
    print("\n" + "="*70)
    print("TEST SUITE COMPLETE")
    print("="*70)
    print("\nSummary:")
    print("✓ Tested cross-path learning detection")
    print("✓ Tested personalized recommendations per user")
    print("✓ Tested skill tracking and module completion")
    print("\nNext: Run `python backend/test_learning_continuity_advanced.py`")

