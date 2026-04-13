# Antigravity / SkillCrew

> Autonomous AI-driven learning platform that transforms learner onboarding, planning, content curation, assessment, and motivation into one intelligent experience.

## What this project is

A modern learning system powered by five specialized autonomous agents. It combines a Next.js frontend with a FastAPI backend to provide:

- AI-driven learner onboarding from resumes and LinkedIn profiles
- Domain-agnostic personalized learning roadmaps
- Curated learning resources and study plans
- Spaced-repetition reinforcement and knowledge retention workflows
- Assessment generation, grading, and roadmap adaptation
- Progress analytics, gamified engagement, and motivational nudges

## Core features

### 1. Autonomous agent-based learning

SkillCrew is built around five distinct AI agents:

- **Nova** — Intake Specialist
  - Parses and merges resume and LinkedIn profile data
  - Extracts skills, experience, role intent, and project keywords
  - Creates the canonical learner profile for downstream planning

- **Archie** — The Architect / Planner
  - Designs multi-week, milestone-based learning roadmaps
  - Creates lesson sequences, content suggestions, checkpoint quizzes, and certification recommendations
  - Revises roadmaps dynamically based on quiz feedback and learner signals

- **Dexter** — Resource Curator
  - Discovers and ranks learning resources from across the web
  - Aligns resources to learner level, pace, and preferences
  - Builds practical study modules and content bundles

- **Pip** — Memory Guardian
  - Supports spaced repetition, active recall, and concept reinforcement
  - Generates review packs, quizzes, and memory-focused revision content
  - Helps maintain momentum by strengthening retention over time

- **Sparky** — Motivation Coach
  - Tracks progress and engagement signals
  - Sends motivational nudges, email and SMS notifications, and achievement alerts
  - Provides gamified progress analytics and streak-based rewards

## Unique selling propositions (USPs)

### Unified end-to-end learning flow

SkillCrew moves beyond isolated chatbots or static courses by combining onboarding, planning, curation, assessment, and motivation into one continuous learner experience.

### Profile-aware personalization

The system reads resumes and LinkedIn data to build a richer learner profile, then generates roadmaps that align with real-world experience and target goals.

### Domain-agnostic planning

Archie is designed to plan for any field — not just software — with structured weekly milestones, real study lessons, and certifications tailored to the learner’s intent.

### Adaptive, feedback-driven roadmaps

Learning plans are not fixed. The platform can revise roadmaps when quizzes show weak areas, when learners ask for pacing changes, or when behavior signals indicate a need for adjustment.

### Integrated assessment & adjustment

Assessments are part of the learning loop, not an afterthought. The platform generates quizzes, evaluates submissions, and feeds performance back into roadmap adaptation.

### Modern web + AI stack

Built with a scalable, service-oriented architecture:

- Frontend: `Next.js 16`, `React 19`, `Tailwind CSS`, `Zod`, `Supabase`, `Framer Motion`
- Backend: `FastAPI`, `Uvicorn`, `Pydantic`, `Supabase Python`, `Google Gemini`, `Groq`, `Apify`, `Twilio`, `SendGrid`, `Resend`
- Data services: Supabase for persistence, multiple LLM sources for flexible AI generation

## Technical architecture

### Frontend

- `frontend/` implements the public landing pages, authentication flows, dashboard experience, agent UI, and analytics widgets.
- The UI is branded as SkillCrew and showcases the five agent personas.
- Uses modern React hooks, UI components, and animation libraries for an engaging web experience.

### Backend

- `backend/main.py` is the FastAPI entry point.
- `backend/agents_api.py` exposes internal endpoints for the autonomous agents.
- `backend/assessments_api.py` handles assessment generation, submission, grading, and roadmap adjustment.
- Backend services include profile ingestion, roadmap generation, resource discovery, learning continuity, and notification dispatch.

### Service integrations

- **Supabase** for project data, user state, and service-client access
- **Google Gemini / Groq** for LLM-powered roadmap and content generation
- **Apify / Firecrawl** for LinkedIn scraping and profile ingestion
- **Twilio** for outbound SMS/WhatsApp/voice nudges
- **SendGrid / Resend** for email engagement
- **YT-DLP / youtube-transcript-api** for transcript extraction and media context

## What you can build with this repo

- Personalized learning platforms and upskilling assistants
- AI-driven onboarding engines for training programs
- Skill gap analysis and adaptive curriculum engines
- Gamified study systems with retention workflows
- Coaching platforms that merge progress analytics with automated reminders

## Development and run instructions

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Root convenience scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Environment configuration

The backend expects environment variables such as:

- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY` / `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GROQ_API_KEY`, `GROQ_MODEL`
- `BACKEND_AGENT_SECRET`
- `APIFY_API_TOKEN`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `SENDGRID_API_KEY`, `RESEND_API_KEY`

The frontend also relies on public Supabase and backend secrets for API access.

## Key directories

- `backend/` — FastAPI services, agents, integrations, assessment engines
- `frontend/` — Next.js UI, landing pages, agent dashboard, auth flows
- `frontend/lib/agents.ts` — definitions for Nova, Archie, Dexter, Pip, Sparky
- `backend/agents_api.py` — protected agent orchestration endpoints
- `backend/assessments_api.py` — assessment creation, grading, and completion flows

## Why this project matters

SkillCrew is more than an AI demo. It is a full-stack, multi-agent scaffold for intelligent learning systems that can onboard real learners, create meaningful study journeys, and keep them engaged over time. The architecture is designed for experimentation, extension, and production-grade learning automation.


## Developers
* [Nandini](https://github.com/nandininema07)
* [Atharva](https://github.com/atharva-0932)
* [Parv](https://github.com/ParvSiria)
* [Gargee](https://github.com/g-sowani)

---

Built for rapid AI learning product development and experimentation, Antigravity / SkillCrew is an ideal starting point for anyone creating next-generation learning assistants.