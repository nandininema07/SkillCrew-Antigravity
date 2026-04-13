'use client'

import { cn } from '@/lib/utils'
import { Sparkles, Route, Search, Brain, Zap } from 'lucide-react'
import type { AgentId } from '@/lib/types'

const iconMap = {
  nova: Sparkles,
  archie: Route,
  dexter: Search,
  pip: Brain,
  sparky: Zap,
}

const colorMap: Record<AgentId, { bg: string; glow: string; text: string }> = {
  nova: {
    bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.5)]',
    text: 'text-white',
  },
  archie: {
    bg: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.5)]',
    text: 'text-white',
  },
  dexter: {
    bg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.5)]',
    text: 'text-white',
  },
  pip: {
    bg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.5)]',
    text: 'text-black',
  },
  sparky: {
    bg: 'bg-gradient-to-br from-orange-500 to-red-500',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.5)]',
    text: 'text-white',
  },
}

interface AgentAvatarProps {
  agentId: AgentId
  size?: 'sm' | 'md' | 'lg' | 'xl'
  active?: boolean
  showGlow?: boolean
  className?: string
}

export function AgentAvatar({ 
  agentId, 
  size = 'md', 
  active = false, 
  showGlow = true,
  className 
}: AgentAvatarProps) {
  const Icon = iconMap[agentId]
  const colors = colorMap[agentId]
  
  const sizeClasses = {
    sm: 'size-8',
    md: 'size-10',
    lg: 'size-14',
    xl: 'size-20',
  }
  
  const iconSizes = {
    sm: 'size-4',
    md: 'size-5',
    lg: 'size-7',
    xl: 'size-10',
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full transition-all duration-300',
        sizeClasses[size],
        colors.bg,
        colors.text,
        showGlow && active && colors.glow,
        active && 'ring-2 ring-white/30 ring-offset-2 ring-offset-background',
        className
      )}
    >
      <Icon className={cn(iconSizes[size], active && 'animate-pulse')} />
      {active && (
        <span className="absolute -bottom-0.5 -right-0.5 flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-green-500" />
        </span>
      )}
    </div>
  )
}
