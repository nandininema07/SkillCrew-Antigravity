-- Capstone project: spend 300 XP once to unlock (per roadmap), at end of track (UI).

ALTER TABLE public.user_archie_roadmaps
  ADD COLUMN IF NOT EXISTS capstone_unlocked_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.user_archie_roadmaps.capstone_unlocked_at IS
  'When set, user spent 300 XP to unlock the end-of-course capstone for this roadmap.';

-- Atomic unlock: deduct XP, recompute level, set flag. Matches JS levelFromXp (500 XP per level tier).
CREATE OR REPLACE FUNCTION public.unlock_roadmap_capstone(p_roadmap_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_xp int;
  v_new_xp int;
  v_level int;
  v_unlocked timestamptz;
  v_cost int := 300;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT capstone_unlocked_at INTO v_unlocked
  FROM public.user_archie_roadmaps
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'roadmap_not_found';
  END IF;

  IF v_unlocked IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_unlocked', true);
  END IF;

  SELECT COALESCE(xp, 0) INTO v_xp FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_xp < v_cost THEN
    RAISE EXCEPTION 'insufficient_xp';
  END IF;

  v_new_xp := v_xp - v_cost;
  v_level := GREATEST(1, 1 + FLOOR(GREATEST(0, v_new_xp)::numeric / 500)::int);

  UPDATE public.profiles
  SET xp = v_new_xp, level = v_level, updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.user_archie_roadmaps
  SET capstone_unlocked_at = now(), updated_at = now()
  WHERE id = p_roadmap_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_unlocked', false,
    'xp', v_new_xp,
    'level', v_level,
    'xp_spent', v_cost
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_roadmap_capstone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_roadmap_capstone(uuid) TO authenticated;
