-- Agent pipelines: learner signals, roadmap snapshots, quiz history, profile context

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS learning_direction TEXT,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.user_context_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_context_events_user_created
  ON public.user_context_events(user_id, created_at DESC);

ALTER TABLE public.user_context_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_context_events_select_own"
  ON public.user_context_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_context_events_insert_own"
  ON public.user_context_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.archie_roadmap_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_mode TEXT NOT NULL,
  bundle JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archie_snapshots_user_mode_created
  ON public.archie_roadmap_snapshots(user_id, roadmap_mode, created_at DESC);

ALTER TABLE public.archie_roadmap_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archie_snapshots_select_own"
  ON public.archie_roadmap_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "archie_snapshots_insert_own"
  ON public.archie_roadmap_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz JSONB NOT NULL,
  grade JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_created
  ON public.quiz_sessions(user_id, created_at DESC);

ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_sessions_select_own"
  ON public.quiz_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "quiz_sessions_insert_own"
  ON public.quiz_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quiz_sessions_update_own"
  ON public.quiz_sessions FOR UPDATE
  USING (auth.uid() = user_id);
