'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AgentAvatar } from '@/components/agents/agent-avatar'
import { agents, agentOrder } from '@/lib/agents'
import { useAppStore } from '@/lib/store'
import {
  LayoutDashboard,
  Briefcase,
  Brain,
  Trophy,
  Settings,
  HelpCircle,
  LogOut,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Flame,
  MessageSquare,
  Award,
  Workflow,
} from 'lucide-react'

const ORCHESTRATION_URL = 'https://react-node-flow-agentic-ai.vercel.app'

const navItems = [
  {
    title: 'Command Center',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Progress',
    href: '/dashboard/progress',
    icon: Trophy,
  },
  {
    title: 'Agent Chat',
    href: '/dashboard/chat',
    icon: MessageSquare,
  },
  {
    title: 'Make me Job Ready',
    href: '/dashboard/job-ready',
    icon: Briefcase,
  },
  {
    title: 'Leaderboard',
    href: '/dashboard/leaderboard',
    icon: Award,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, activeAgent, setActiveAgent } = useAppStore()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-1 px-2 py-1.5">
          <SidebarTrigger className="shrink-0" />
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-0.5 pr-1"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">SkillCrew</span>
              <span className="text-[10px] text-muted-foreground">Learn Smarter</span>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="View Orchestration (opens in new tab)">
                  <a
                    href={ORCHESTRATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Workflow className="size-4" />
                    <span>View Orchestration</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible defaultOpen>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 outline-none ring-sidebar-ring focus-visible:ring-2 [&[data-state=open]>svg]:rotate-180">
                Your Crew
                <ChevronDown className="ml-auto size-4 shrink-0 transition-transform duration-200" aria-hidden />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {agentOrder.map((id) => {
                    const agent = agents[id]
                    const isActive = activeAgent === id
                    return (
                      <SidebarMenuItem key={id}>
                        <Collapsible
                          className={cn(
                            'w-full min-w-0',
                            '[&[data-state=open]_button_svg]:rotate-180',
                          )}
                        >
                          <div className="flex w-full min-w-0 items-center gap-0.5">
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setActiveAgent(isActive ? null : id)}
                              tooltip={`${agent.name} — ${agent.role}`}
                              className="group/agent min-w-0 flex-1 pr-1"
                            >
                              <AgentAvatar agentId={id} size="sm" active={isActive} showGlow={false} />
                              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                              <span
                                className={cn(
                                  'size-2 shrink-0 rounded-full transition-colors',
                                  isActive ? 'bg-primary' : 'bg-sidebar-foreground/25',
                                )}
                              />
                            </SidebarMenuButton>
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/80 outline-none ring-sidebar-ring transition-colors',
                                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                  'focus-visible:ring-2',
                                  'group-data-[collapsible=icon]:hidden',
                                )}
                                aria-label={`What ${agent.name} does`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ChevronDown
                                  className="size-4 shrink-0 transition-transform duration-200"
                                  aria-hidden
                                />
                              </button>
                            </CollapsibleTrigger>
                          </div>
                          <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                            <div
                              className={cn(
                                'mt-1 space-y-2 border-l-2 border-sidebar-primary/40 pl-3 text-left',
                                'text-xs leading-relaxed text-sidebar-foreground/90',
                              )}
                            >
                              <p className="text-[11px] font-semibold tracking-wide text-sidebar-primary">
                                {agent.role}
                              </p>
                              <p className="text-sidebar-foreground/85">{agent.description}</p>
                              <ul className="list-disc space-y-1 pl-3.5 text-[11px] text-sidebar-foreground/75">
                                {agent.capabilities.map((cap) => (
                                  <li key={cap}>{cap}</li>
                                ))}
                              </ul>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* <SidebarSeparator /> */}

      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/dashboard/settings">
                <Settings className="size-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help & Support">
              <Link href="/dashboard/help">
                <HelpCircle className="size-4" />
                <span>Help</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SidebarSeparator className="my-2" />
        
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
        >
          <Avatar className="size-9 border-2 border-primary/20">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                Lv {user?.level ?? 1}
              </Badge>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {(user?.xp ?? 0).toLocaleString()} XP
              </span>
            </div>
          </div>
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground group-data-[collapsible=icon]:hidden">
            <ChevronRight className="size-4" />
          </span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
