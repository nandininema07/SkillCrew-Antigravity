/**
 * Assessment and Learning Roadmap Integration Service
 * Handles all API interactions for the dynamic roadmap system
 */

import { createClient } from '@/lib/supabase/client'

export interface AssessmentResult {
  success: boolean
  score: number
  xp_earned: number
  performance_level: string
  penalties: number
  roadmap_adjusted: boolean
  deep_dive_modules: any[]
}

export interface ModuleCompletion {
  moduleId: string
  skillsLearned: string[]
  timestamp: Date
}

export class AssessmentService {
  private supabase = createClient()

  /**
   * Generate assessment questions for a set of modules
   */
  async generateAssessment(params: {
    roadmapId: string
    moduleIds: string[]
    assessmentType: 'quiz' | 'coding_test' | 'debugging_test'
    difficulty: 'easy' | 'medium' | 'hard'
    numQuestions?: number
    moduleContent: Record<string, any>
  }): Promise<{
    assessment: any
    questions: any[]
  }> {
    try {
      const response = await fetch('/api/assessments/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`Assessment generation failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating assessment:', error)
      throw error
    }
  }

  /**
   * Submit a quiz answer and get feedback
   */
  async submitQuizAnswer(params: {
    assessmentId: string
    questionId: string
    userAnswerIndex: number
    timeSpentSeconds?: number
  }): Promise<{
    is_correct: boolean
    points_earned: number
    max_points: number
    explanation: string
  }> {
    try {
      const response = await fetch('/api/assessments/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: params.assessmentId,
          question_id: params.questionId,
          user_answer: params.userAnswerIndex.toString(),
          time_spent_seconds: params.timeSpentSeconds,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit answer: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error submitting quiz answer:', error)
      throw error
    }
  }

  /**
   * Submit code for coding or debugging test
   */
  async submitCode(params: {
    assessmentId: string
    questionId: string
    code: string
    timeSpentSeconds?: number
  }): Promise<{
    is_correct: boolean
    points_earned: number
    max_points: number
    test_results: {
      passed: number
      total: number
    }
  }> {
    try {
      const response = await fetch('/api/assessments/submit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`Failed to submit code: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error submitting code:', error)
      throw error
    }
  }

  /**
   * Complete assessment and calculate score + trigger adjustments
   */
  async completeAssessment(params: {
    assessmentId: string
    assessmentType: string
    difficulty: string
    totalTimeSeconds?: number
  }): Promise<AssessmentResult> {
    try {
      const response = await fetch('/api/assessments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`Failed to complete assessment: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error completing assessment:', error)
      throw error
    }
  }

  /**
   * Get user's skill proficiency tracking
   */
  async getUserPerformance(userId: string) {
    try {
      const response = await fetch(`/api/assessments/performance/${userId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch performance: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching performance:', error)
      throw error
    }
  }

  /**
   * Get active dynamic adjustments for a roadmap
   */
  async getRoadmapAdjustments(params: {
    roadmapId: string
    userId: string
  }) {
    try {
      const response = await fetch(
        `/api/assessments/roadmap/${params.roadmapId}/adjustments?user_id=${params.userId}`
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch adjustments: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching roadmap adjustments:', error)
      throw error
    }
  }
}

/**
 * Module Completion Service
 * Tracks module completion and skill acquisition
 */
export class ModuleCompletionService {
  private supabase = createClient()

  /**
   * Record module completion in database
   */
  async recordModuleCompletion(params: {
    roadmapId: string
    moduleId: string
    skillsLearned: string[]
    timeSpentMinutes?: number
  }): Promise<void> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      // Record completion in module_completion_track
      await this.supabase.from('module_completion_track').insert({
        user_id: user.id,
        roadmap_id: params.roadmapId,
        module_id: params.moduleId,
        status: 'completed',
        completed_at: new Date().toISOString(),
        time_spent_minutes: params.timeSpentMinutes,
        skills_acquired: params.skillsLearned,
      })

      // Update skill proficiency tracking
      for (const skill of params.skillsLearned) {
        const { data: existing } = await this.supabase
          .from('skill_proficiency_tracking')
          .select('*')
          .eq('user_id', user.id)
          .eq('skill', skill)
          .single()

        if (existing) {
          // Update existing proficiency
          await this.supabase
            .from('skill_proficiency_tracking')
            .update({
              times_tested: (existing.times_tested || 0) + 1,
              source_roadmap_id: params.roadmapId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          // Create new proficiency record
          await this.supabase.from('skill_proficiency_tracking').insert({
            user_id: user.id,
            skill,
            times_tested: 1,
            times_correct: 0,
            mastery_level: 'beginner',
            source_roadmap_id: params.roadmapId,
          })
        }
      }
    } catch (error) {
      console.error('Error recording module completion:', error)
      throw error
    }
  }

  /**
   * Check if user already knows a skill
   */
  async hasSkill(skill: string): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return false

      const { data, error } = await this.supabase
        .from('skill_proficiency_tracking')
        .select('mastery_level')
        .eq('user_id', user.id)
        .eq('skill', skill)
        .single()

      if (error) return false

      // Consider skill as known if at developing level or higher
      const masteryLevels = ['developing', 'proficient', 'expert']
      return data && masteryLevels.includes(data.mastery_level)
    } catch (error) {
      console.error('Error checking skill:', error)
      return false
    }
  }

  /**
   * Get all skills user has learned
   */
  async getUserSkills(): Promise<string[]> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) return []

      const { data } = await this.supabase
        .from('skill_proficiency_tracking')
        .select('skill')
        .eq('user_id', user.id)

      return (data || []).map(d => d.skill)
    } catch (error) {
      console.error('Error fetching user skills:', error)
      return []
    }
  }
}

/**
 * XP and Leaderboard Service
 * Manages XP tracking and leaderboard updates
 */
export class XPService {
  private supabase = createClient()

  /**
   * Award XP to user for assessment performance
   */
  async awardXP(params: {
    xpAmount: number
    reason: string
  }): Promise<void> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      // Get current profile XP
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('xp')
        .eq('id', user.id)
        .single()

      const currentXP = profile?.xp || 0
      const newXP = currentXP + params.xpAmount

      // Update profile XP
      await this.supabase
        .from('profiles')
        .update({ xp: newXP })
        .eq('id', user.id)

      // You can add XP history logging here if needed
    } catch (error) {
      console.error('Error awarding XP:', error)
      throw error
    }
  }

  /**
   * Get current user's XP and leaderboard rank
   */
  async getUserStats(): Promise<{
    xp: number
    rank: number
    totalPlayers: number
  }> {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (!user) throw new Error('User not authenticated')

      // Get user profile
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('xp, level')
        .eq('id', user.id)
        .single()

      // Get leaderboard stats
      const { data: leaderboard } = await this.supabase
        .from('profiles')
        .select('id, xp')
        .order('xp', { ascending: false })

      const userXP = profile?.xp || 0
      const rank = (leaderboard || []).findIndex(p => p.id === user.id) + 1
      const totalPlayers = leaderboard?.length || 0

      return {
        xp: userXP,
        rank: rank > 0 ? rank : totalPlayers,
        totalPlayers,
        level: profile?.level ?? 1,
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
      return { xp: 0, rank: 0, totalPlayers: 0 }
    }
  }

  /**
   * Get leaderboard rankings
   */
  async getLeaderboard(limit: number = 10): Promise<
    Array<{
      rank: number
      userId: string
      name: string
      xp: number
      avatar?: string
    }>
  > {
    try {
      const { data: leaderboard } = await this.supabase
        .from('profiles')
        .select('id, name, avatar, xp, level, streak')
        .order('xp', { ascending: false })
        .limit(limit)

      return (leaderboard || []).map((entry, idx) => ({
        rank: idx + 1,
        userId: entry.id,
        name: entry.name || 'Unknown',
        xp: entry.xp || 0,
        avatar: entry.avatar,
        level: entry.level ?? 1,
        streak: entry.streak ?? 0,
      }))
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      return []
    }
  }
}

// Export as singletons
export const assessmentService = new AssessmentService()
export const moduleCompletionService = new ModuleCompletionService()
export const xpService = new XPService()
