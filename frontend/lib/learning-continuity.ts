/**
 * Learning Continuity Utility Functions
 * API wrapper for cross-path learning intelligence
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ModuleCompletionParams {
  userId: string
  moduleId: string
  pathId: string
  timeSpentMinutes?: number
  performanceScore?: number
  skillsAcquired?: string[]
}

/**
 * Record a module completion for the user
 */
export async function recordModuleCompletion(params: ModuleCompletionParams) {
  try {
    const formData = new URLSearchParams({
      user_id: params.userId,
      module_id: params.moduleId,
      path_id: params.pathId,
      ...(params.timeSpentMinutes && {
        time_spent_minutes: params.timeSpentMinutes.toString(),
      }),
      ...(params.performanceScore !== undefined && {
        performance_score: params.performanceScore.toString(),
      }),
      ...(params.skillsAcquired && {
        skills_acquired: JSON.stringify(params.skillsAcquired),
      }),
    })

    const response = await fetch(`${API_BASE}/api/record-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to record completion: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error recording module completion:', error)
    throw error
  }
}

/**
 * Get user's complete learning history across all paths
 */
export async function getLearningHistory(userId: string) {
  try {
    const response = await fetch(`${API_BASE}/api/learning-history/${userId}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch learning history: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error fetching learning history:', error)
    throw error
  }
}

/**
 * Filter modules for a new path based on what user already learned
 */
export async function filterModulesForNewPath(userId: string, modules: any[]) {
  try {
    const formData = new URLSearchParams({
      user_id: userId,
      modules_data: JSON.stringify(modules),
    })

    const response = await fetch(`${API_BASE}/api/filter-modules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to filter modules: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error filtering modules:', error)
    throw error
  }
}

/**
 * Generate a personalized roadmap based on user's learning history
 */
export async function generateContextualRoadmap(
  userId: string,
  targetPath: string,
  userProfile: any,
  availableModules: any[],
  options?: { syllabusSourceText?: string | null }
) {
  try {
    const formData = new URLSearchParams({
      user_id: userId,
      target_path: targetPath,
      user_profile_data: JSON.stringify(userProfile),
      available_modules_data: JSON.stringify(availableModules),
    })
    const s = options?.syllabusSourceText
    if (typeof s === 'string' && s.trim()) {
      formData.set('syllabus_source_text', s.trim())
    }

    const response = await fetch(`${API_BASE}/api/agent/generate-contextual-roadmap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate roadmap: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error generating roadmap:', error)
    throw error
  }
}

/**
 * Get suggestions for the next learning path
 */
export async function suggestNextPath(
  userId: string,
  candidatePaths: any[],
  options?: { syllabusSourceText?: string | null }
) {
  try {
    const formData = new URLSearchParams({
      user_id: userId,
      candidate_paths_data: JSON.stringify(candidatePaths),
    })
    const s = options?.syllabusSourceText
    if (typeof s === 'string' && s.trim()) {
      formData.set('syllabus_source_text', s.trim())
    }

    const response = await fetch(`${API_BASE}/api/agent/suggest-next-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get suggestions: ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    console.error('Error getting suggestions:', error)
    throw error
  }
}