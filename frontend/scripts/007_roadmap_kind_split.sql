-- Split Skills vs Job ready roadmaps; optional link from job row to skills topic; interview role hint on skills rows.

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS week_gate_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS roadmap_kind TEXT NOT NULL DEFAULT 'combined';

DO $$
BEGIN
  ALTER TABLE public.user_archie_roadmaps
    ADD CONSTRAINT user_archie_roadmaps_roadmap_kind_check
    CHECK (roadmap_kind IN ('combined', 'skills', 'job_ready'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS recommended_job_title TEXT;

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS linked_skills_roadmap_id UUID REFERENCES public.user_archie_roadmaps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_archie_roadmaps_user_kind
  ON public.user_archie_roadmaps(user_id, roadmap_kind, created_at DESC);

COMMENT ON COLUMN public.user_archie_roadmaps.roadmap_kind IS 'combined = legacy all-in-one; skills = teaching path; job_ready = interview prep';
COMMENT ON COLUMN public.user_archie_roadmaps.recommended_job_title IS 'Suggested job title for Job ready (from skills topic)';
COMMENT ON COLUMN public.user_archie_roadmaps.linked_skills_roadmap_id IS 'If set on job_ready row, ties interview prep to a skills roadmap';
