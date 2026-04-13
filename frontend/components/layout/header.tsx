'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import { Bell, Flame, LogOut, Settings, Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { toast } from 'sonner'

export function Header() {
  const router = useRouter()
  const user = useAppStore((s) => s.user)

  /** Store is updated by DashboardSessionSync (GET /api/profile) and by capstone unlock (RPC xp + setUser). */
  const displayXp = user?.xp ?? 0
  const displayStreak = user?.streak ?? 0

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 flex h-17 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4">
      <div className="min-w-0 flex-1" />


      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild aria-label="Settings">
          <Link href="/dashboard/settings">
            <Settings className="size-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
        </Button>
        <div
          className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 sm:px-3"
          title={`${displayStreak}-day streak`}
          aria-label={`${displayStreak} day streak`}
        >
          <Flame className="size-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
          <span className="text-sm font-medium tabular-nums text-amber-700 dark:text-amber-300">
            {displayStreak}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1.5 sm:px-3"
          title="Account XP"
          aria-label={`${displayXp} XP`}
        >
          <Zap className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-sm font-medium tabular-nums">{displayXp.toLocaleString()} XP</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  )
}
