'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AgentAvatar } from './agent-avatar'
import type { Agent } from '@/lib/types'

interface AgentCardProps {
  agent: Agent
  variant?: 'compact' | 'full' | 'showcase'
  active?: boolean
  onClick?: () => void
  className?: string
}

export function AgentCard({ 
  agent, 
  variant = 'full', 
  active = false, 
  onClick,
  className 
}: AgentCardProps) {
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 rounded-lg p-3 text-left transition-all hover:bg-accent',
          active && 'bg-accent',
          className
        )}
      >
        <AgentAvatar agentId={agent.id} size="sm" active={active} showGlow={false} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{agent.name}</p>
          <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
        </div>
        {agent.status === 'active' && (
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>
    )
  }

  if (variant === 'showcase') {
    return (
      <Card 
        className={cn(
          'group relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50 transition-all duration-300 hover:border-primary/50 hover:shadow-lg',
          active && 'border-primary shadow-lg',
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <AgentAvatar agentId={agent.id} size="lg" active={active} />
            <Badge variant="secondary" className="text-xs">
              {agent.status === 'active' ? 'Active' : 'Ready'}
            </Badge>
          </div>
          <CardTitle className="text-xl mt-4">{agent.name}</CardTitle>
          <CardDescription className="text-primary font-medium">
            {agent.role}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {agent.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.slice(0, 3).map((cap) => (
              <Badge key={cap} variant="outline" className="text-xs font-normal">
                {cap}
              </Badge>
            ))}
            {agent.capabilities.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{agent.capabilities.length - 3} more
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card 
      className={cn(
        'transition-all hover:shadow-md',
        active && 'ring-2 ring-primary',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={agent.id} size="md" active={active} showGlow={false} />
          <div>
            <CardTitle className="text-base">{agent.name}</CardTitle>
            <CardDescription className="text-xs">{agent.role}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{agent.description}</p>
      </CardContent>
    </Card>
  )
}
