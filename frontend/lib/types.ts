export type AgentId = 'nova' | 'archie' | 'dexter' | 'pip' | 'sparky'

export interface Agent {
  id: AgentId
  name: string
  role: string
  description: string
  capabilities: string[]
  color: string
  icon: string
  status: 'idle' | 'active' | 'processing'
}

export interface Skill {
  id: string
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  confidence: number
  lastUpdated: Date
}

export interface LearningModule {
  id: string
  title: string
  description: string
  status: 'locked' | 'available' | 'in-progress' | 'completed'
  progress: number
  estimatedTime: string
  skills: string[]
  agentId: AgentId
}

export interface LearningPath {
  id: string
  title: string
  goal: 'skill-mastery' | 'job-readiness' | 'certification'
  modules: LearningModule[]
  progress: number
  startedAt: Date
  estimatedCompletion: Date
}

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  skills: Skill[]
  currentPath?: LearningPath
  xp: number
  level: number
  streak: number
  badges: Badge[]
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: Date
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface FlashCard {
  id: string
  front: string
  back: string
  difficulty: 'easy' | 'medium' | 'hard'
  nextReview: Date
  mastery: number
  moduleId: string
}

export interface MindMapNode {
  id: string
  label: string
  children: MindMapNode[]
}

export interface MindMap {
  root: string
  children: MindMapNode[]
}

export interface RevisionPack {
  mindmap: MindMap
  flashcards: FlashCard[]
  revision_routine: {
    daily_minutes: number
    cadence_hint: string
    priorities: string[]
  }
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  skill: string
}

export interface Resource {
  id: string
  title: string
  url: string
  type: 'video' | 'article' | 'documentation' | 'interactive'
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  duration: string
  source: string
  rating: number
}

export interface ConceptNode {
  id: string
  label: string
  level: number
  connections: string[]
  mastery: number
}

export interface AgentMessage {
  id: string
  agentId: AgentId
  content: string
  timestamp: Date
  type: 'info' | 'suggestion' | 'alert' | 'celebration'
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatar?: string
  xp: number
  level: number
  streak: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface ChatConversation {
  id: string
  userId: string
  title: string
  summary?: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}
