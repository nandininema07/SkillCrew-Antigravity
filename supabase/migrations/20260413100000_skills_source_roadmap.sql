-- Allow marking skills acquired from roadmap module completion

ALTER TABLE public.skills DROP CONSTRAINT IF EXISTS skills_source_check;
ALTER TABLE public.skills
  ADD CONSTRAINT skills_source_check CHECK (
    source IN ('manual', 'linkedin', 'resume', 'ai_extracted', 'roadmap')
  );
