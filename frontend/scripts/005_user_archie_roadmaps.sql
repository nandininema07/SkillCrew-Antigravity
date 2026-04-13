-- Persisted Archie roadmaps: one row per saved topic (multiple per user). Low-latency reads from DB.

CREATE TABLE IF NOT EXISTS public.user_archie_roadmaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  display_title TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  estimated_completion DATE,
  bundles_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_archie_roadmaps_user_created
  ON public.user_archie_roadmaps(user_id, created_at DESC);

ALTER TABLE public.user_archie_roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_archie_roadmaps_select_own"
  ON public.user_archie_roadmaps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_archie_roadmaps_insert_own"
  ON public.user_archie_roadmaps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_archie_roadmaps_update_own"
  ON public.user_archie_roadmaps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "user_archie_roadmaps_delete_own"
  ON public.user_archie_roadmaps FOR DELETE
  USING (auth.uid() = user_id);
