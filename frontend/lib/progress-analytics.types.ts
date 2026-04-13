export type RoadmapGoal = 'skill-mastery' | 'job-readiness' | 'certification'

export interface ProgressRoadmapTopic {
  id: string
  title: string
  status: 'done' | 'in_progress' | 'pending'
}

/** One roadmap module enriched with Archie's reasoning — used in the X-AI detail view. */
export interface ProgressRoadmapModule {
  id: string
  title: string
  summary: string
  skills: string[]
  milestoneId?: string
  /** Week title (e.g. "Week 1: Introduction to Marketing") */
  milestoneTitle?: string
  /** Short badge e.g. "W1" */
  phaseLabel?: string
  /** Archie's rationale for this week — why it was designed this way for this learner. */
  archieRationale?: string
  /** One-sentence learning outcome for the week. */
  learningObjective?: string
  status: 'done' | 'in_progress' | 'locked' | 'pending'
}

export interface ProgressRoadmapQuiz {
  id: string
  title: string
  purpose: string
  followsTopicId?: string
  milestoneId?: string
  submittedAt?: string
  scorePercent?: number
  xpGained?: number
  weakTopics?: string[]
}

export interface AgentAdaptationThinking {
  timestamp: string
  scorePercent: number
  reason: string
  weakTopics: string[]
  adaptationMessage: string
  modulesAdded: string[]
  roadmapMode: 'skills' | 'job_ready'
}

export interface ProgressRoadmapSummary {
  id: string
  title: string
  description: string
  /** Archie's overall plan rationale — shown as the intro "X-AI" explanation. */
  planRationale?: string
  goal: RoadmapGoal
  progressPercent: number
  /** Actual completed modules count */
  nodesCompleted: number
  /** Total modules in the roadmap */
  nodesTotal: number
  estimatedCompletion: string | null
  /** Full module list with Archie rationale for the X-AI layer */
  modules: ProgressRoadmapModule[]
  topicsCovered: ProgressRoadmapTopic[]
  topicsRemaining: ProgressRoadmapTopic[]
  quizzes: ProgressRoadmapQuiz[]
  adaptationThinking: AgentAdaptationThinking[]
}

export interface ProgressAnalyticsPayload {
  roadmaps: ProgressRoadmapSummary[]
  moduleTimeRows: Array<{ topic: string; allottedHours: number; spentHours: number }>
  weeklyTrend: Array<{ week: string; xp: number; courses: number }>
  xpEarnedLast7Days: number
  monthlyAssessmentXp: number
  monthlyModuleCompletions: number
  skillsTracked: number
  proficientSkillsCount: number
  skillDistribution: Array<{ name: string; value: number }>
  timeAllocation: Array<{ name: string; hours: number; percentage: number }>
  goals: Array<{ label: string; progress: number; detail: string }>
  flags: {
    module_completion_track_available: boolean
    assessment_performance_available: boolean
  }
}
