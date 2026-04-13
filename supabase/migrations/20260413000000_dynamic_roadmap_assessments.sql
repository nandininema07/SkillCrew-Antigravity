-- Dynamic Roadmap Assessment & Performance Tracking
-- Includes quiz questions, coding tests, debugging tests, and roadmap adjustments

-- Assessment Types: 'quiz', 'coding_test', 'debugging_test'
-- Difficulty: 'easy', 'medium', 'hard'

CREATE TABLE IF NOT EXISTS public.roadmap_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roadmap_id UUID NOT NULL REFERENCES public.user_archie_roadmaps(id) ON DELETE CASCADE,
  module_ids TEXT[] NOT NULL, -- Array of module IDs this assessment covers
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('quiz', 'coding_test', 'debugging_test')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  title TEXT NOT NULL,
  description TEXT,
  skills_tested TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  estimated_time_minutes INTEGER DEFAULT 15,
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.roadmap_assessments(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'coding', 'debugging')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  skill TEXT NOT NULL, -- Skill being tested
  question_text TEXT NOT NULL,
  
  -- For multiple choice
  options JSONB, -- Array of {text, is_correct}
  correct_answer_index INTEGER,
  explanation TEXT,
  
  -- For coding/debugging tests
  starter_code TEXT,
  expected_output TEXT,
  test_cases JSONB, -- Array of {input, expected_output}
  rubric JSONB, -- Scoring criteria
  
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.roadmap_assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.assessment_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Response content
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned DECIMAL(5,2) DEFAULT 0,
  max_points DECIMAL(5,2) DEFAULT 10,
  
  -- For coding tests: execution result
  execution_output TEXT,
  execution_error TEXT,
  passed_test_cases INTEGER,
  total_test_cases INTEGER,
  
  -- Timing
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assessment_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES public.user_archie_roadmaps(id) ON DELETE CASCADE,
  
  assessment_id UUID NOT NULL REFERENCES public.roadmap_assessments(id) ON DELETE CASCADE,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  score DECIMAL(5,2) NOT NULL, -- Percentage 0-100
  performance_level TEXT DEFAULT 'beginner' CHECK (performance_level IN ('beginner', 'developing', 'proficient', 'expert')),
  
  -- XP tracking
  xp_earned INTEGER DEFAULT 0,
  penalty_points INTEGER DEFAULT 0, -- Penalty for easy questions failed
  
  -- Failed topics for deep dive
  failed_skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  failed_questions JSONB, -- Array of {question_id, skill, difficulty}
  
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roadmap_dynamic_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES public.user_archie_roadmaps(id) ON DELETE CASCADE,
  
  trigger_assessment_id UUID REFERENCES public.roadmap_assessments(id) ON DELETE SET NULL,
  trigger_skill TEXT NOT NULL, -- Skill that user failed
  trigger_difficulty TEXT CHECK (trigger_difficulty IN ('easy', 'medium', 'hard')),
  
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('deep_dive_module', 'remedial_content', 'additional_practice')),
  adjustment_content JSONB NOT NULL, -- {module_title, content, duration, resources}
  
  inserted_at_position INTEGER, -- Position in roadmap where inserted
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track user's skill proficiency across all assessments
CREATE TABLE IF NOT EXISTS public.skill_proficiency_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill TEXT NOT NULL,
  
  -- Proficiency metrics
  times_tested INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  avg_score DECIMAL(5,2),
  mastery_level TEXT DEFAULT 'novice' CHECK (mastery_level IN ('novice', 'beginner', 'developing', 'proficient', 'expert')),
  
  -- Last assessment
  last_assessed TIMESTAMPTZ,
  last_score DECIMAL(5,2),
  
  source_roadmap_id UUID REFERENCES public.user_archie_roadmaps(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, skill)
);

-- Module completion with skill tracking
CREATE TABLE IF NOT EXISTS public.module_completion_track (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES public.user_archie_roadmaps(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  skills_acquired TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, roadmap_id, module_id)
);

-- Enable RLS
ALTER TABLE public.roadmap_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_dynamic_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_proficiency_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_completion_track ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roadmap_assessments
CREATE POLICY "roadmap_assessments_select_own_roadmap" ON public.roadmap_assessments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_archie_roadmaps
    WHERE id = roadmap_id AND user_id = auth.uid()
  ));

CREATE POLICY "roadmap_assessments_insert_own_roadmap" ON public.roadmap_assessments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_archie_roadmaps
    WHERE id = roadmap_id AND user_id = auth.uid()
  ));

-- RLS Policies for assessment_questions
CREATE POLICY "assessment_questions_select" ON public.assessment_questions FOR SELECT USING (TRUE);

-- RLS Policies for assessment_responses
CREATE POLICY "assessment_responses_select_own" ON public.assessment_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assessment_responses_insert_own" ON public.assessment_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assessment_responses_update_own" ON public.assessment_responses FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for assessment_performance
CREATE POLICY "assessment_performance_select_own" ON public.assessment_performance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "assessment_performance_insert_own" ON public.assessment_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assessment_performance_update_own" ON public.assessment_performance FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for roadmap_dynamic_adjustments
CREATE POLICY "roadmap_dynamic_adjustments_select_own" ON public.roadmap_dynamic_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "roadmap_dynamic_adjustments_insert_own" ON public.roadmap_dynamic_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for skill_proficiency_tracking
CREATE POLICY "skill_proficiency_tracking_select_own" ON public.skill_proficiency_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "skill_proficiency_tracking_insert_own" ON public.skill_proficiency_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "skill_proficiency_tracking_update_own" ON public.skill_proficiency_tracking FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for module_completion_track
CREATE POLICY "module_completion_track_select_own" ON public.module_completion_track FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "module_completion_track_insert_own" ON public.module_completion_track FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "module_completion_track_update_own" ON public.module_completion_track FOR UPDATE
  USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_roadmap_assessments_roadmap_id ON public.roadmap_assessments(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_skill ON public.assessment_questions(skill);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_user_id ON public.assessment_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment_id ON public.assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_question_id ON public.assessment_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_assessment_performance_user_id ON public.assessment_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_performance_roadmap_id ON public.assessment_performance(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_assessment_performance_failed_skills ON public.assessment_performance USING GIN(failed_skills);
CREATE INDEX IF NOT EXISTS idx_roadmap_dynamic_adjustments_user_id ON public.roadmap_dynamic_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_dynamic_adjustments_roadmap_id ON public.roadmap_dynamic_adjustments(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_skill_proficiency_tracking_user_id ON public.skill_proficiency_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_proficiency_tracking_skill ON public.skill_proficiency_tracking(skill);
CREATE INDEX IF NOT EXISTS idx_module_completion_track_user_id ON public.module_completion_track(user_id);
CREATE INDEX IF NOT EXISTS idx_module_completion_track_roadmap_id ON public.module_completion_track(roadmap_id);
