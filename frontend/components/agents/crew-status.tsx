'use client'

import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'
import { agents, agentOrder } from '@/lib/agents'
import { useAppStore } from '@/lib/store'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface CrewStatusProps {
  showConnections?: boolean
  variant?: 'inline' | 'vertical'
  className?: string
}

export function CrewStatus({ 
  showConnections = true, 
  variant = 'inline',
  className 
}: CrewStatusProps) {
  const activeAgent = useAppStore((s) => s.activeAgent)

  if (variant === 'vertical') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <TooltipProvider>
          {agentOrder.map((id, index) => (
            <div key={id} className="flex flex-col items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <AgentAvatar 
                      agentId={id} 
                      size="sm" 
                      active={activeAgent === id}
                      showGlow={activeAgent === id}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col gap-1">
                  <p className="font-medium">{agents[id].name}</p>
                  <p className="text-xs text-muted-foreground">{agents[id].role}</p>
                </TooltipContent>
              </Tooltip>
              {showConnections && index < agentOrder.length - 1 && (
                <div className="h-4 w-px bg-border" />
              )}
            </div>
          ))}
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <TooltipProvider>
        {agentOrder.map((id, index) => (
          <div key={id} className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <AgentAvatar 
                    agentId={id} 
                    size="sm" 
                    active={activeAgent === id}
                    showGlow={activeAgent === id}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{agents[id].name}</p>
                <p className="text-xs text-muted-foreground">{agents[id].role}</p>
              </TooltipContent>
            </Tooltip>
            {showConnections && index < agentOrder.length - 1 && (
              <div className="mx-1 h-px w-3 bg-gradient-to-r from-border to-border/50" />
            )}
          </div>
        ))}
      </TooltipProvider>
    </div>
  )
}
