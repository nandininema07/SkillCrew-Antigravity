"""Backend validation script for learning continuity endpoints."""

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE_URL = "http://127.0.0.1:8000"
TEST_USER_ID = "7580ebd2-ed5f-4231-82e3-0f53d6d7ed77"
TEST_MODULE_ID = str(uuid.uuid4())


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


def run_tests():
    tests = []

    tests.append(("GET /api/health", lambda: _get("/api/health")))
    tests.append(("GET /api/learning-history/{user_id}", lambda: _get(f"/api/learning-history/{TEST_USER_ID}")))

    tests.append(
        (
            "POST /api/record-completion",
            lambda: _post(
                "/api/record-completion",
                {
                    "user_id": TEST_USER_ID,
                    "module_id": "550e8400-e29b-41d4-a716-446655440010",
                    "path_id": "11111111-1111-1111-1111-111111111111",
                    "time_spent_minutes": "150",
                    "performance_score": "92",
                    "skills_acquired": json.dumps(["SQL", "Database", "PostgreSQL"]),
                },
            ),
        )
    )

    tests.append(
        (
            "POST /api/filter-modules",
            lambda: _post(
                "/api/filter-modules",
                {
                    "user_id": TEST_USER_ID,
                    "modules_data": json.dumps([
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440010",
                            "title": "Python for ML",
                            "skills": ["Python", "NumPy", "Pandas"],
                        },
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440011",
                            "title": "Building ML APIs",
                            "skills": ["REST", "API", "FastAPI", "ML"],
                        },
                    ]),
                },
            ),
        )
    )

    tests.append(
        (
            "POST /api/agent/generate-contextual-roadmap",
            lambda: _post(
                "/api/agent/generate-contextual-roadmap",
                {
                    "user_id": TEST_USER_ID,
                    "target_path": "22222222-2222-2222-2222-222222222222",
                    "user_profile_data": json.dumps({
                        "completed_paths": 1,
                        "skills": ["Python", "REST", "API", "FastAPI"],
                    }),
                    "available_modules_data": json.dumps([
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440010",
                            "title": "Python for ML",
                            "skills": ["Python", "NumPy", "Pandas"],
                        },
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440011",
                            "title": "Building ML APIs",
                            "skills": ["REST", "API", "FastAPI", "ML"],
                        },
                        {
                            "id": "550e8400-e29b-41d4-a716-446655440012",
                            "title": "Deep Learning",
                            "skills": ["TensorFlow", "Neural Networks"],
                        },
                    ]),
                },
            ),
        )
    )

    print("Running backend learning continuity endpoint validation...")
    for label, action in tests:
        status, body = action()
        print("\n---")
        print(label)
        print("status:", status)
        print(body)


if __name__ == "__main__":
    run_tests()
                {
                    "user_id": TEST_USER_ID,
                    "module_id": "550e8400-e29b-41d4-a716-446655440010",
                    "path_id": "22222222-2222-2222-2222-222222222222",
                    "time_spent_minutes": "60",
                    "performance_score": "90",
                    "skills_acquired": json.dumps(["SQL", "Database"]),
                },
            ),
        )
    )

    tests.append(
        (
            "POST /api/filter-modules",
            lambda: _post(
                "/api/filter-modules",
                {
                    "user_id": TEST_USER_ID,
                    "modules_data": json.dumps(
                        [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440010",
                                "title": "Python for ML",
                                "skills": ["Python", "NumPy", "Pandas"],
                            },
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440011",
                                "title": "Building ML APIs",
                                "skills": ["REST", "API", "FastAPI", "ML"],
                            },
                        ]
                    ),
                },
            ),
        )
    )

    tests.append(
        (
            "POST /api/agent/generate-contextual-roadmap",
            lambda: _post(
                "/api/agent/generate-contextual-roadmap",
                {
                    "user_id": TEST_USER_ID,
                    "target_path": "22222222-2222-2222-2222-222222222222",
                    "user_profile_data": json.dumps(
                        {
                            "completed_paths": 1,
                            "skills": ["Python", "REST", "API", "FastAPI"],
                        }
                    ),
                    "available_modules_data": json.dumps(
                        [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440010",
                                "title": "Python for ML",
                                "skills": ["Python", "NumPy", "Pandas"],
                            },
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440011",
                                "title": "Building ML APIs",
                                "skills": ["REST", "API", "FastAPI", "ML"],
                            },
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440012",
                                "title": "Deep Learning",
                                "skills": ["TensorFlow", "Neural Networks"],
                            },
                        ]
                    ),
                },
            ),
        )
    )

    print("Running backend learning continuity endpoint validation...")
    for label, action in tests:
        status, body = action()
        print("\n---")
        print(label)
        print("status:", status)
        print(body)


if __name__ == "__main__":
    run_tests()
