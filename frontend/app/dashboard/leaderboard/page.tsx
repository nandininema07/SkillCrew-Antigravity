'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'
import { levelFromXp } from '@/lib/gamification-xp'
import { Trophy, Medal, Flame, Zap, Award, Crown } from 'lucide-react'

type LeaderboardApiEntry = {
  rank: number
  userId: string
  name: string
  avatar?: string
  xp: number
  level: number
  streak: number
}

type Row = LeaderboardApiEntry & { initials: string; isCurrentUser: boolean }

export default function LeaderboardPage() {
  const { user } = useAppStore()
  const [activeTab, setActiveTab] = useState('xp')
  const [xpRows, setXpRows] = useState<LeaderboardApiEntry[]>([])
  const [streakRows, setStreakRows] = useState<LeaderboardApiEntry[]>([])
  const [levelRows, setLevelRows] = useState<LeaderboardApiEntry[]>([])
  const [profileXp, setProfileXp] = useState(0)
  const [profileStreak, setProfileStreak] = useState(0)
  const [profileLevel, setProfileLevel] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [xpRes, stRes, lvRes, profRes] = await Promise.all([
          fetch('/api/leaderboard?sort=xp&limit=25', { credentials: 'include' }),
          fetch('/api/leaderboard?sort=streak&limit=25', { credentials: 'include' }),
          fetch('/api/leaderboard?sort=level&limit=25', { credentials: 'include' }),
          fetch('/api/profile', { credentials: 'include' }),
        ])
        const xpJson = (await xpRes.json()) as { items?: LeaderboardApiEntry[]; error?: string }
        const stJson = (await stRes.json()) as { items?: LeaderboardApiEntry[]; error?: string }
        const lvJson = (await lvRes.json()) as { items?: LeaderboardApiEntry[]; error?: string }
        const prof = (await profRes.json()) as {
          xp?: number
          streak?: number
          level?: number
          error?: string
        }

        if (!xpRes.ok) throw new Error(xpJson.error || 'Could not load XP leaderboard')
        if (!stRes.ok) throw new Error(stJson.error || 'Could not load streak leaderboard')
        if (!lvRes.ok) throw new Error(lvJson.error || 'Could not load level leaderboard')

        setXpRows(xpJson.items || [])
        setStreakRows(stJson.items || [])
        setLevelRows(lvJson.items || [])

        if (profRes.ok && !prof.error) {
          const x = typeof prof.xp === 'number' ? prof.xp : 0
          setProfileXp(x)
          setProfileStreak(typeof prof.streak === 'number' ? prof.streak : 0)
          setProfileLevel(typeof prof.level === 'number' ? prof.level : levelFromXp(x))
        }
      } catch (e) {
        console.error(e)
        setLoadError(e instanceof Error ? e.message : 'Could not load leaderboards')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [user?.id])

  const initials = (name: string) =>
    name
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'U'

  const withMeta = (items: LeaderboardApiEntry[]): Row[] =>
    items.map((e) => ({
      ...e,
      initials: initials(e.name),
      isCurrentUser: !!(user?.id && e.userId === user.id),
    }))

  const leaderboardData = useMemo(
    () => ({
      xp: withMeta(xpRows),
      streak: withMeta(streakRows),
      level: withMeta(levelRows),
    }),
    [xpRows, streakRows, levelRows, user?.id],
  )

  const getRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="size-5 text-amber-500" />
      case 2:
        return <Medal className="size-5 text-slate-400" />
      case 3:
        return <Medal className="size-5 text-orange-600" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const achievements = [
    {
      id: '1',
      name: 'First Steps',
      description: 'Complete your first module',
      icon: '🎯',
      rarity: 'common',
      earned: true,
      earnedAt: '2024-01-15',
    },
    {
      id: '2',
      name: 'On Fire',
      description: 'Maintain a 7-day streak',
      icon: '🔥',
      rarity: 'common',
      earned: true,
      earnedAt: '2024-01-20',
    },
    {
      id: '3',
      name: 'Quick Learner',
      description: 'Complete 5 modules in a week',
      icon: '⚡',
      rarity: 'rare',
      earned: false,
    },
    {
      id: '4',
      name: 'XP Master',
      description: 'Earn 1000 total XP',
      icon: '✨',
      rarity: 'rare',
      earned: true,
      earnedAt: '2024-01-25',
    },
    {
      id: '5',
      name: 'Perfect Score',
      description: 'Get 100% on a quiz',
      icon: '💯',
      rarity: 'epic',
      earned: false,
    },
    {
      id: '6',
      name: 'Master of All',
      description: 'Master 5 different skills',
      icon: '👑',
      rarity: 'legendary',
      earned: false,
    },
  ]

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="size-8" />
            Leaderboards & Achievements
          </h1>
          <p className="text-muted-foreground">
            Rankings use live data: XP from daily logins and Pip quizzes (including score bonuses), and streaks from
            consecutive login days.
          </p>
          {!isLoading && (
            <p className="text-sm text-muted-foreground">
              Your stats:{' '}
              <span className="font-medium text-foreground">
                {profileXp.toLocaleString()} XP · L{profileLevel} · {profileStreak} day streak
              </span>
            </p>
          )}
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5" />
              Community Leaderboards
            </CardTitle>
            <CardDescription>Top learners by XP, streak, or level (from your SkillCrew community)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading leaderboards…</p>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="xp" className="gap-2">
                    <Zap className="size-4" />
                    XP Earned
                  </TabsTrigger>
                  <TabsTrigger value="streak" className="gap-2">
                    <Flame className="size-4" />
                    Streak
                  </TabsTrigger>
                  <TabsTrigger value="level" className="gap-2">
                    <Award className="size-4" />
                    Level
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="xp" className="mt-6 space-y-3">
                  {leaderboardData.xp.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No players yet — invite your team.</p>
                  ) : (
                    leaderboardData.xp.map((entry) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          entry.isCurrentUser
                            ? 'bg-primary/10 border-primary/30'
                            : 'hover:bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {getRankMedal(entry.rank)}
                        </div>
                        <Avatar className="size-10 flex-shrink-0">
                          {entry.avatar ? <AvatarImage src={entry.avatar} alt="" /> : null}
                          <AvatarFallback className="text-sm font-bold">{entry.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            {entry.name}
                            {entry.isCurrentUser && <Badge className="ml-2">You</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">Level {entry.level}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-lg tabular-nums">{entry.xp.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">XP</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="streak" className="mt-6 space-y-3">
                  {leaderboardData.streak.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No streak data yet.</p>
                  ) : (
                    leaderboardData.streak.map((entry) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          entry.isCurrentUser
                            ? 'bg-primary/10 border-primary/30'
                            : 'hover:bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {getRankMedal(entry.rank)}
                        </div>
                        <Avatar className="size-10 flex-shrink-0">
                          {entry.avatar ? <AvatarImage src={entry.avatar} alt="" /> : null}
                          <AvatarFallback className="text-sm font-bold">{entry.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            {entry.name}
                            {entry.isCurrentUser && <Badge className="ml-2">You</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">Level {entry.level}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center justify-end gap-1">
                            <Flame className="size-4 text-orange-500" />
                            <p className="font-bold text-lg tabular-nums">{entry.streak}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">day streak</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="level" className="mt-6 space-y-3">
                  {leaderboardData.level.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No level data yet.</p>
                  ) : (
                    leaderboardData.level.map((entry) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          entry.isCurrentUser
                            ? 'bg-primary/10 border-primary/30'
                            : 'hover:bg-muted/30 border-border/50'
                        }`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {getRankMedal(entry.rank)}
                        </div>
                        <Avatar className="size-10 flex-shrink-0">
                          {entry.avatar ? <AvatarImage src={entry.avatar} alt="" /> : null}
                          <AvatarFallback className="text-sm font-bold">{entry.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            {entry.name}
                            {entry.isCurrentUser && <Badge className="ml-2">You</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">{entry.xp.toLocaleString()} XP</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-lg">L{entry.level}</p>
                          <p className="text-xs text-muted-foreground">Level</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5" />
              Achievements & Badges
            </CardTitle>
            <CardDescription>
              {achievements.filter((a) => a.earned).length} of {achievements.length} badges earned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border text-center transition-all ${
                    achievement.earned
                      ? 'bg-card border-border/50 hover:shadow-lg'
                      : 'bg-muted/20 border-muted opacity-50 hover:opacity-75'
                  }`}
                >
                  <div className="text-4xl">{achievement.icon}</div>
                  <h4 className="font-semibold text-sm line-clamp-2">{achievement.name}</h4>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  <Badge
                    variant={achievement.earned ? 'default' : 'outline'}
                    className={`text-[10px] capitalize ${
                      achievement.rarity === 'legendary'
                        ? 'border-amber-500/50 text-amber-500'
                        : achievement.rarity === 'epic'
                          ? 'border-purple-500/50 text-purple-500'
                          : achievement.rarity === 'rare'
                            ? 'border-blue-500/50 text-blue-500'
                            : ''
                    }`}
                  >
                    {achievement.rarity}
                  </Badge>
                  {achievement.earned && achievement.earnedAt && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(achievement.earnedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How XP & streaks work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <Flame className="size-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Login streak</h4>
                  <p className="text-sm text-muted-foreground">
                    Visit the app on consecutive UTC days to grow your streak. The streak leaderboard ranks learners by
                    longest current streak.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Zap className="size-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">XP from activity</h4>
                  <p className="text-sm text-muted-foreground">
                    You earn XP for each new login day, each Pip checkpoint (completion bonus), how you answer
                    questions, and a bonus tied to your quiz score.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Trophy className="size-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Leaderboards</h4>
                  <p className="text-sm text-muted-foreground">
                    XP and level boards reflect total experience. Streak shows consecutive login days — open the app at
                    least once per day to keep it going.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Award className="size-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Level</h4>
                  <p className="text-sm text-muted-foreground">
                    Level increases every 500 XP. Same profile stats power your dashboard and Archie context.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
