// Database types matching Supabase schema
export interface DBProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  resume_url: string | null
  xp: number
  level: number
  streak: number
  learning_direction?: string | null
  last_active_at?: string | null
  /** UTC calendar date (YYYY-MM-DD) of last daily login XP grant */
  last_login_date?: string | null
  /** Twilio: daily learning recap on WhatsApp after local digest time */
  notify_whatsapp_digest?: boolean
  /** Twilio: voice recap (optional); same window as WhatsApp */
  notify_voice_daily_learning?: boolean
  /** HH:mm (24h) in `sparky_digest_timezone` */
  sparky_digest_local_time?: string | null
  /** IANA timezone for digest scheduling */
  sparky_digest_timezone?: string | null
  created_at: string
  updated_at: string
}

export interface DBSkill {
  id: string
  user_id: string
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  confidence: number
  source: 'manual' | 'linkedin' | 'resume' | 'ai_extracted' | 'roadmap'
  created_at: string
  updated_at: string
}

export interface DBWorkExperience {
  id: string
  user_id: string
  company: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  source: 'manual' | 'linkedin' | 'resume'
  created_at: string
  updated_at: string
}

export interface DBLearningPath {
  id: string
  user_id: string
  title: string
  goal: 'skill-mastery' | 'job-readiness' | 'certification'
  progress: number
  is_active: boolean
  started_at: string
  estimated_completion: string | null
  created_at: string
  updated_at: string
}

export interface DBLearningModule {
  id: string
  path_id: string
  title: string
  description: string | null
  status: 'locked' | 'available' | 'in-progress' | 'completed'
  progress: number
  estimated_time: string | null
  skills: string[] | null
  agent_id: string | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface DBBadge {
  id: string
  user_id: string
  name: string
  description: string | null
  icon: string | null
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  earned_at: string
  created_at: string
}

export interface DBFlashcard {
  id: string
  user_id: string
  module_id: string | null
  front: string
  back: string
  difficulty: 'easy' | 'medium' | 'hard'
  mastery: number
  next_review: string
  created_at: string
  updated_at: string
}

/** Mock interview: transcript + optional cached analysis (see supabase/migrations/*mock_interview*) */
export interface DBMockInterviewSession {
  id: string
  user_id: string
  target_role: string
  transcript: string
  analysis_report: string | null
  vapi_assistant_id: string | null
  vapi_call_id: string | null
  vapi_structured_output: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface DBUserPreferences {
  id: string
  user_id: string
  difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  learning_pace: 'slow' | 'balanced' | 'fast'
  preferred_content: 'video' | 'text' | 'interactive' | 'mixed'
  daily_goal_minutes: number
  email_notifications: boolean
  push_notifications: boolean
  daily_reminders: boolean
  streak_alerts: boolean
  created_at: string
  updated_at: string
}
