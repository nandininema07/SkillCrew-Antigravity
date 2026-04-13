-- Per-roadmap weekly unlock: only week 1 starts accessible; later weeks unlock after >75% on Pip for the prior week.
-- Stored separately from AI bundles so Archie revise does not reset progress.

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS week_gate_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_archie_roadmaps.week_gate_progress IS
  'JSON: { "skills": { "last_passed_week": 0 }, "job_ready": { "last_passed_week": 0 } }. Week 1 active when last_passed_week is 0.';
