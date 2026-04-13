/**
 * Dynamic Roadmap System - TypeScript Type Definitions
 */

// Assessment Types
export type AssessmentType = 'quiz' | 'coding_test' | 'debugging_test'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'
export type PerformanceLevel = 'beginner' | 'developing' | 'proficient' | 'expert'
export type MasteryLevel = 'novice' | 'beginner' | 'developing' | 'proficient' | 'expert'
export type ContentType = 'article' | 'video' | 'documentation' | 'book' | 'podcast'

// Module Types
export interface RoadmapModule {
  id: string
  title: string
  description: string
  skills: string[]
  estimatedDuration: number // minutes
  sections: ModuleSection[]
  status: 'locked' | 'available' | 'in-progress' | 'completed'
  completed: boolean
  moduleIndex: number
  totalModules: number
}

export interface ModuleSection {
  id: string
  title: string
  description: string
  keyPts?: string[]
  resources: ContentResource[]
  estimatedTime?: number
}

export interface ContentResource {
  type: ContentType
  title: string
  url: string
  description?: string
  duration?: string
  source?: string
}

// Assessment Types
export interface AssessmentMetadata {
  id: string
  roadmapId: string
  moduleIds: string[]
  assessmentType: AssessmentType
  difficulty: DifficultyLevel
  title: string
  description?: string
  skillsTested: string[]
  estimatedTimeMinutes: number
  status: 'ready' | 'in_progress' | 'completed'
  createdAt: Date
}

export interface QuizQuestion {
  id: string
  assessmentId: string
  type: 'multiple_choice'
  difficulty: DifficultyLevel
  skill: string
  questionText: string
  options: string[]
  correctAnswerIndex: number
  explanation: string
  sequenceNumber: number
}

export interface CodingQuestion {
  id: string
  assessmentId: string
  type: 'coding'
  difficulty: DifficultyLevel
  skill: string
  problemDescription: string
  starterCode: string
  testCases: TestCase[]
  rubric: ScoringRubric
  sequenceNumber: number
}

export interface DebuggingQuestion {
  id: string
  assessmentId: string
  type: 'debugging'
  difficulty: DifficultyLevel
  skill: string
  description: string
  buggyCode: string
  testCases: TestCase[]
  expectedFixedCode: string
  bugTypes: string[]
  sequenceNumber: number
}

export type Question = QuizQuestion | CodingQuestion | DebuggingQuestion

export interface TestCase {
  input: Record<string, any>
  expectedOutput: string
  currentOutput?: string
}

export interface ScoringRubric {
  correctness: number // percentage
  codeQuality?: number
  efficiency?: number
  [key: string]: number | undefined
}

// User Response Types
export interface AssessmentResponse {
  id: string
  assessmentId: string
  questionId: string
  userId: string
  userAnswer: string
  isCorrect: boolean
  pointsEarned: number
  maxPoints: number
  executionOutput?: string
  executionError?: string
  passedTestCases?: number
  totalTestCases?: number
  timeSpentSeconds?: number
  createdAt: Date
}

export interface AnswerFeedback {
  isCorrect: boolean
  pointsEarned: number
  maxPoints: number
  explanation?: string
  testResults?: {
    passed: number
    total: number
  }
}

// Performance Tracking
export interface AssessmentPerformance {
  id: string
  userId: string
  roadmapId: string
  assessmentId: string
  totalQuestions: number
  correctAnswers: number
  score: number // percentage 0-100
  performanceLevel: PerformanceLevel
  xpEarned: number
  penaltyPoints: number
  failedSkills: string[]
  failedQuestions: FailedQuestion[]
  completedAt: Date
}

export interface FailedQuestion {
  questionId: string
  skill: string
  difficulty: DifficultyLevel
}

export interface SkillProficiency {
  id: string
  userId: string
  skill: string
  timesTested: number
  timesCorrect: number
  avgScore: number
  masteryLevel: MasteryLevel
  lastAssessed?: Date
  lastScore?: number
  sourceRoadmapId?: string
}

// Dynamic Adjustment Types
export interface DynamicAdjustment {
  id: string
  userId: string
  roadmapId: string
  triggerAssessmentId: string
  triggerSkill: string
  triggerDifficulty: DifficultyLevel
  adjustmentType: 'deep_dive_module' | 'remedial_content' | 'additional_practice'
  adjustmentContent: DeepDiveModule
  insertedAtPosition?: number
  isActive: boolean
  createdAt: Date
}

export interface DeepDiveModule {
  moduleTitle: string
  description: string
  learningObjectives: string[]
  contentSections: ContentSection[]
  resources: ContentResource[]
  estimatedDurationMinutes: number
  relatedSkill: string
  difficultyProgression: DifficultyLevel[]
}

export interface ContentSection {
  sectionTitle: string
  description: string
  keyConcepts?: string[]
  explanation: string
  examples?: Example[]
  mistakes?: CommonMistake[]
}

export interface Example {
  title: string
  explanation: string
  codeOrDemo?: string
}

export interface CommonMistake {
  mistakeType: string
  explanation: string
  howToAvoid: string
}

// Module Completion Tracking
export interface ModuleCompletion {
  id: string
  userId: string
  roadmapId: string
  moduleId: string
  status: 'in_progress' | 'completed' | 'skipped'
  completedAt?: Date
  timeSpentMinutes?: number
  skillsAcquired: string[]
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatar?: string
  xp: number
  level: number
  streak: number
  performanceLevel?: PerformanceLevel
}

export interface UserStats {
  xp: number
  rank: number
  totalPlayers: number
  level: number
  streak: number
  masteredSkills: string[]
  developingSkills: string[]
}

// API Request/Response Types
export interface GenerateAssessmentRequest {
  roadmapId: string
  moduleIds: string[]
  assessmentType: AssessmentType
  difficulty: DifficultyLevel
  numQuestions?: number
  moduleContent: Record<string, any>
  userPreferences?: Record<string, any>
}

export interface GenerateAssessmentResponse {
  success: boolean
  assessment: AssessmentMetadata
  questions: Question[]
  numQuestions: number
}

export interface SubmitAnswerRequest {
  assessmentId: string
  questionId: string
  userAnswer: string
  timeSpentSeconds?: number
}

export interface SubmitCodeRequest {
  assessmentId: string
  questionId: string
  code: string
  timeSpentSeconds?: number
}

export interface CompleteAssessmentRequest {
  assessmentId: string
  assessmentType: AssessmentType
  difficulty: DifficultyLevel
  totalTimeSeconds?: number
}

export interface AssessmentResultResponse {
  success: boolean
  score: number // percentage
  xpEarned: number
  performanceLevel: PerformanceLevel
  penalties: number
  roadmapAdjusted: boolean
  deepDiveModules: DeepDiveModule[]
}

// Kudos/Achievement Types
export type KudosType = 'correct_answer' | 'perfect_score' | 'deep_dive_added' | 'skill_mastered'

export interface KudosMessage {
  id: string
  type: KudosType
  title: string
  message: string
  xpEarned?: number
  pointsEarned?: number
  icon?: React.ReactNode
  color?: string
}

// Component Props Types
export interface ModuleViewerProps {
  module: RoadmapModule
  onComplete: (moduleId: string, skillsLearned: string[]) => Promise<void>
  onAssessmentReady?: (moduleSectionCount: number) => void
  isLoading?: boolean
}

export interface AssessmentViewerProps {
  assessmentId: string
  assessmentType: AssessmentType
  difficulty: DifficultyLevel
  questions: Question[]
  onAnswerSubmit: (questionId: string, answer: string) => Promise<void>
  onAssessmentComplete: (responses: Array<{ questionId: string; answer: string }>) => Promise<void>
}

export interface KudosPopupProps {
  message: KudosMessage
  isVisible: boolean
  onDismiss: () => void
  autoHideDuration?: number
}

export interface DynamicAdjustmentNotificationProps {
  adjustments: DeepDiveModule[]
  onAcknowledge: (skill: string) => void
  onStartDeepDive: (skill: string) => void
}

// State Management Types
export interface RoadmapState {
  roadmapId: string
  modules: RoadmapModule[]
  currentModuleIndex: number
  completedModuleIds: string[]
  dynamicAdjustments: DynamicAdjustment[]
  assessmentInProgress?: AssessmentMetadata
}

export interface AssessmentState {
  assessmentId: string
  currentQuestionIndex: number
  responses: Record<string, AssessmentResponse>
  startTime: Date
  isSubmitting: boolean
}

export interface UserLearningState {
  userId: string
  totalXP: number
  masteredSkills: string[]
  developingSkills: string[]
  leaderboardRank: number
  consecutiveCorrect: number
  lastAssessmentScore?: number
}
