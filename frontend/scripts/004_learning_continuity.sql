-- Learning Continuity Schema
-- Tracks user's historical learning, module completions, and cross-path equivalency

-- Module Completion History table
CREATE TABLE IF NOT EXISTS public.module_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  time_spent_minutes INTEGER,
  performance_score DECIMAL(5,2), -- 0-100
  skills_acquired TEXT[], -- Array of skill names learned
  was_skipped BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id) -- User can only complete a module once
);

-- Module Equivalency table (AI-detected similar modules across paths)
CREATE TABLE IF NOT EXISTS public.module_equivalencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_a_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  module_b_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  similarity_score DECIMAL(3,2) NOT NULL, -- 0-1, higher means more similar
  overlapping_skills TEXT[], -- Skills that both modules teach
  detected_by TEXT DEFAULT 'ai_analysis', -- 'ai_analysis', 'manual', 'user_submitted'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (module_a_id != module_b_id),
  UNIQUE(module_a_id, module_b_id)
);

-- Learning Context History table (tracks enrolled paths chronologically)
CREATE TABLE IF NOT EXISTS public.learning_context_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  enrollment_order INTEGER NOT NULL, -- 1st path, 2nd path, etc.
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_modules_completed INTEGER DEFAULT 0,
  total_skills_gained INTEGER DEFAULT 0,
  average_performance DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skill Endorsements table (tracks which skills user has from completed modules)
CREATE TABLE IF NOT EXISTS public.skill_endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  source_module_id UUID REFERENCES public.learning_modules(id) ON DELETE SET NULL,
  source_path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  endorsed_at TIMESTAMPTZ DEFAULT NOW(),
  proficiency_level TEXT CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert')) DEFAULT 'beginner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill_name, source_path_id)
);

-- Mark completion as RLS enabled
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_equivalencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_context_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for module_completions
CREATE POLICY "module_completions_select_own" ON public.module_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "module_completions_insert_own" ON public.module_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "module_completions_update_own" ON public.module_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "module_completions_delete_own" ON public.module_completions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for module_equivalencies (public read, admin write)
CREATE POLICY "module_equivalencies_select" ON public.module_equivalencies FOR SELECT USING (TRUE);
CREATE POLICY "module_equivalencies_admin_write" ON public.module_equivalencies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()) -- Only authenticated users
);

-- RLS Policies for learning_context_history
CREATE POLICY "learning_context_history_select_own" ON public.learning_context_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "learning_context_history_insert_own" ON public.learning_context_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "learning_context_history_update_own" ON public.learning_context_history FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for skill_endorsements
CREATE POLICY "skill_endorsements_select_own" ON public.skill_endorsements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "skill_endorsements_insert_own" ON public.skill_endorsements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skill_endorsements_update_own" ON public.skill_endorsements FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_module_completions_user_id ON public.module_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_completions_path_id ON public.module_completions(path_id);
CREATE INDEX IF NOT EXISTS idx_module_completions_completed_at ON public.module_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_module_equivalencies_module_a ON public.module_equivalencies(module_a_id);
CREATE INDEX IF NOT EXISTS idx_module_equivalencies_module_b ON public.module_equivalencies(module_b_id);
CREATE INDEX IF NOT EXISTS idx_module_equivalencies_similarity ON public.module_equivalencies(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_learning_context_history_user_id ON public.learning_context_history(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_context_history_enrollment_order ON public.learning_context_history(enrollment_order);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_user_id ON public.skill_endorsements(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_endorsements_skill_name ON public.skill_endorsements(skill_name);
