-- Login calendar (distinct days) for streak + XP.
-- Optional: leaderboard_by_* RPCs below — the app prefers SUPABASE_SERVICE_ROLE_KEY + direct profiles queries (no PostgREST schema cache for RPCs).

CREATE TABLE IF NOT EXISTS public.user_login_days (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, login_date)
);

CREATE INDEX IF NOT EXISTS idx_user_login_days_user ON public.user_login_days(user_id);

ALTER TABLE public.user_login_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_login_days_insert_own" ON public.user_login_days;
CREATE POLICY "user_login_days_insert_own"
  ON public.user_login_days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_login_days_select_own" ON public.user_login_days;
CREATE POLICY "user_login_days_select_own"
  ON public.user_login_days FOR SELECT
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_date DATE;

COMMENT ON COLUMN public.profiles.last_login_date IS 'UTC calendar date of last daily activity ping (streak bump).';

-- Leaderboard: expose only gamification fields (no email) to authenticated users.
CREATE OR REPLACE FUNCTION public.leaderboard_by_xp(limit_count int)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  xp integer,
  level integer,
  streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.xp, p.level, p.streak
  FROM public.profiles p
  ORDER BY p.xp DESC NULLS LAST, p.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(limit_count, 10), 100));
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_by_streak(limit_count int)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  xp integer,
  level integer,
  streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.xp, p.level, p.streak
  FROM public.profiles p
  ORDER BY p.streak DESC NULLS LAST, p.xp DESC NULLS LAST, p.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(limit_count, 10), 100));
$$;

CREATE OR REPLACE FUNCTION public.leaderboard_by_level(limit_count int)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  xp integer,
  level integer,
  streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.xp, p.level, p.streak
  FROM public.profiles p
  ORDER BY p.level DESC NULLS LAST, p.xp DESC NULLS LAST, p.id ASC
  LIMIT GREATEST(1, LEAST(COALESCE(limit_count, 10), 100));
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard_by_xp(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_by_streak(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leaderboard_by_level(int) TO authenticated;
