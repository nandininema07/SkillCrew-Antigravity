-- Mirror of supabase/migrations/20260413100000_skills_source_roadmap.sql
ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_source_check;
ALTER TABLE public.skills
  ADD CONSTRAINT skills_source_check CHECK (
    source IN ('manual', 'linkedin', 'resume', 'ai_extracted', 'roadmap')
  );
