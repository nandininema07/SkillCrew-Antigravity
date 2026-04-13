-- SkillCrew Database Schema
-- Creates all necessary tables for user profiles, skills, work experience, and learning paths

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skills table
CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')) DEFAULT 'beginner',
  confidence DECIMAL(3,2) DEFAULT 0.50,
  source TEXT CHECK (source IN ('manual', 'linkedin', 'resume', 'ai_extracted')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Work Experience table
CREATE TABLE IF NOT EXISTS public.work_experiences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  source TEXT CHECK (source IN ('manual', 'linkedin', 'resume')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Paths table
CREATE TABLE IF NOT EXISTS public.learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goal TEXT CHECK (goal IN ('skill-mastery', 'job-readiness', 'certification')) NOT NULL,
  progress DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  estimated_completion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning Modules table
CREATE TABLE IF NOT EXISTS public.learning_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('locked', 'available', 'in-progress', 'completed')) DEFAULT 'locked',
  progress DECIMAL(5,2) DEFAULT 0,
  estimated_time TEXT,
  skills TEXT[], -- Array of skill names
  agent_id TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  rarity TEXT CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')) DEFAULT 'common',
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.learning_modules(id) ON DELETE SET NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  mastery DECIMAL(3,2) DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')) DEFAULT 'intermediate',
  learning_pace TEXT CHECK (learning_pace IN ('slow', 'balanced', 'fast')) DEFAULT 'balanced',
  preferred_content TEXT CHECK (preferred_content IN ('video', 'text', 'interactive', 'mixed')) DEFAULT 'mixed',
  daily_goal_minutes INTEGER DEFAULT 30,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  daily_reminders BOOLEAN DEFAULT TRUE,
  streak_alerts BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- RLS Policies for skills
CREATE POLICY "skills_select_own" ON public.skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "skills_insert_own" ON public.skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "skills_update_own" ON public.skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "skills_delete_own" ON public.skills FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for work_experiences
CREATE POLICY "work_experiences_select_own" ON public.work_experiences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "work_experiences_insert_own" ON public.work_experiences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "work_experiences_update_own" ON public.work_experiences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "work_experiences_delete_own" ON public.work_experiences FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for learning_paths
CREATE POLICY "learning_paths_select_own" ON public.learning_paths FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "learning_paths_insert_own" ON public.learning_paths FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "learning_paths_update_own" ON public.learning_paths FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "learning_paths_delete_own" ON public.learning_paths FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for learning_modules
CREATE POLICY "learning_modules_select_own" ON public.learning_modules FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.learning_paths WHERE id = path_id AND user_id = auth.uid()));
CREATE POLICY "learning_modules_insert_own" ON public.learning_modules FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.learning_paths WHERE id = path_id AND user_id = auth.uid()));
CREATE POLICY "learning_modules_update_own" ON public.learning_modules FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.learning_paths WHERE id = path_id AND user_id = auth.uid()));
CREATE POLICY "learning_modules_delete_own" ON public.learning_modules FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.learning_paths WHERE id = path_id AND user_id = auth.uid()));

-- RLS Policies for badges
CREATE POLICY "badges_select_own" ON public.badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "badges_insert_own" ON public.badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "badges_update_own" ON public.badges FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "badges_delete_own" ON public.badges FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for flashcards
CREATE POLICY "flashcards_select_own" ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "flashcards_insert_own" ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flashcards_update_own" ON public.flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "flashcards_delete_own" ON public.flashcards FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_preferences
CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_skills_user_id ON public.skills(user_id);
CREATE INDEX IF NOT EXISTS idx_work_experiences_user_id ON public.work_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON public.learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_modules_path_id ON public.learning_modules(path_id);
CREATE INDEX IF NOT EXISTS idx_badges_user_id ON public.badges(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON public.flashcards(user_id);
