import type { Agent, AgentId } from './types'

export const agents: Record<AgentId, Agent> = {
  nova: {
    id: 'nova',
    name: 'Nova',
    role: 'Intake Specialist',
    description: 'I analyze your profile and extract skills from your resume or LinkedIn. I help you get started on the right path.',
    capabilities: [
      'Resume parsing & skill extraction',
      'LinkedIn profile analysis',
      'Goal alignment assessment',
      'Skill gap identification'
    ],
    color: 'nova',
    icon: 'Sparkles',
    status: 'idle'
  },
  archie: {
    id: 'archie',
    name: 'Archie',
    role: 'The Architect / Planner',
    description:
      'Methodical planner obsessed with structure and blueprints—always ready to redraw the plan. Merges Nova’s view of your skills with your target role, explains why the roadmap is ordered this way, and restructures when quizzes or behavior say so. Chat with him to slow down, accelerate, or personalize.',
    capabilities: [
      'Milestone roadmap generation & redundancy avoidance',
      'Explainability for every milestone',
      'Dynamic restructuring from quiz & behavior signals',
      'Conversational plan edits (pace & focus)',
    ],
    color: 'archie',
    icon: 'Route',
    status: 'idle'
  },
  dexter: {
    id: 'dexter',
    name: 'Dexter',
    role: 'Resource Curator',
    description: 'I find and curate the best learning resources across the web, matching them to your current level.',
    capabilities: [
      'Resource discovery',
      'Quality assessment',
      'Difficulty matching',
      'Interactive sandbox setup'
    ],
    color: 'dexter',
    icon: 'Search',
    status: 'idle'
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    role: 'Memory Guardian',
    description: 'I help you retain what you learn through spaced repetition, concept mapping, and active recall.',
    capabilities: [
      'Spaced repetition scheduling',
      'Concept map generation',
      'Flashcard creation',
      'Knowledge reinforcement'
    ],
    color: 'pip',
    icon: 'Brain',
    status: 'idle'
  },
  sparky: {
    id: 'sparky',
    name: 'Sparky',
    role: 'Motivation Coach',
    description: 'I track your progress, celebrate wins, and keep you motivated with gamification and insights.',
    capabilities: [
      'Progress analytics',
      'Achievement tracking',
      'Streak management',
      'Leaderboard ranking'
    ],
    color: 'sparky',
    icon: 'Zap',
    status: 'idle'
  }
}

export const agentOrder: AgentId[] = ['nova', 'archie', 'dexter', 'pip', 'sparky']

export function getAgentById(id: AgentId): Agent {
  return agents[id]
}

export function getAgentColor(id: AgentId): string {
  const colors: Record<AgentId, string> = {
    nova: 'bg-nova text-white',
    archie: 'bg-archie text-white',
    dexter: 'bg-dexter text-white',
    pip: 'bg-pip text-black',
    sparky: 'bg-sparky text-white'
  }
  return colors[id]
}

export function getAgentGlow(id: AgentId): string {
  return `glow-${id}`
}
