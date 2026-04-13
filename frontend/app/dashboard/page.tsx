'use client'

import { useState, useEffect, useRef, type ChangeEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArchieCertificationsPanel } from '@/components/dashboard/archie-certifications-panel'
import type { ArchieCertificationsBundle } from '@/lib/archie-certifications-mock'
import type { ArchieRoadmapBundle } from '@/lib/archie-roadmap-mock'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Flame,
  TrendingUp,
  Target,
  Zap,
  Award,
  GraduationCap,
  Brain,
  Briefcase,
  Loader2,
  Settings,
  Trash2,
  CalendarDays,
  Upload,
  FileText,
  Youtube,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBProfile, DBSkill, DBWorkExperience } from '@/lib/database.types'
import { inferRecommendedJobTitle } from '@/lib/infer-recommended-job-title'
import { ARCHIE_TAB_STORAGE_KEY } from '@/lib/skillcrew-storage'

type ArchieCommandTab = 'skills' | 'job_ready' | 'certifications'

type RoadmapKind = 'combined' | 'skills' | 'job_ready'

type LearningRoadmapMeta = {
  id: string
  direction: string
  display_title: string
  progress_percent: number
  /** Skills on the user profile that match roadmap module tags (Skills + Job ready). */
  progress_skills_matched?: number
  progress_skills_total?: number
  /** Modules completed vs total on the teaching (skills) track */
  nodes_completed_skills?: number
  nodes_total_skills?: number
  nodes_remaining_skills?: number
  nodes_percent_skills?: number
  /** Modules completed vs total on the interview (job_ready) track */
  nodes_completed_job?: number
  nodes_total_job?: number
  nodes_remaining_job?: number
  nodes_percent_job?: number
  estimated_completion: string | null
  roadmap_kind: RoadmapKind
  recommended_job_title: string | null
  linked_skills_roadmap_id: string | null
  created_at: string
  updated_at: string
}

type LearningRoadmapDetail = LearningRoadmapMeta & {
  bundles: {
    skills: ArchieRoadmapBundle
    job_ready: ArchieRoadmapBundle
    certifications: ArchieCertificationsBundle
  }
}

function formatEta(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(`${iso}T12:00:00Z`)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function todayLocalYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<DBProfile | null>(null)
  const [skills, setSkills] = useState<DBSkill[]>([])
  const [experiences, setExperiences] = useState<DBWorkExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [targetRoleInput, setTargetRoleInput] = useState('')
  const [archieTab, setArchieTab] = useState<ArchieCommandTab>('skills')
  const [roadmaps, setRoadmaps] = useState<LearningRoadmapMeta[]>([])
  const [roadmapsLoading, setRoadmapsLoading] = useState(false)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [buildLoading, setBuildLoading] = useState(false)
  const [jobBuildLoading, setJobBuildLoading] = useState(false)
  const [archieError, setArchieError] = useState<string | null>(null)
  const [jobTitleInput, setJobTitleInput] = useState('')
  const [buildJobDialogOpen, setBuildJobDialogOpen] = useState(false)
  const [linkedSkillsRoadmapId, setLinkedSkillsRoadmapId] = useState<string | null>(null)
  const [certRoadmapId, setCertRoadmapId] = useState<string | null>(null)
  const [certDetail, setCertDetail] = useState<LearningRoadmapDetail | null>(null)
  const [certLoading, setCertLoading] = useState(false)
  const syllabusFileRef = useRef<HTMLInputElement>(null)
  const [syllabusInfo, setSyllabusInfo] = useState<{
    hasSyllabus: boolean
    charCount: number
    filename: string | null
    preview: string
  } | null>(null)
  const [syllabusUploading, setSyllabusUploading] = useState(false)
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState('')
  const [youtubePlaylistInfo, setYoutubePlaylistInfo] = useState<{
    hasPlaylist: boolean
    charCount: number
    videoCount: number
    transcriptsOk: number
    playlistUrl: string | null
    preview: string
  } | null>(null)
  const [youtubePlaylistLoading, setYoutubePlaylistLoading] = useState(false)
  const [buildRoadmapDialogOpen, setBuildRoadmapDialogOpen] = useState(false)
  const [targetDateOpen, setTargetDateOpen] = useState(false)
  const [targetDateRoadmapId, setTargetDateRoadmapId] = useState<string | null>(null)
  const [targetDateValue, setTargetDateValue] = useState('')
  const [targetDateSaving, setTargetDateSaving] = useState(false)

  useEffect(() => {
    try {
      const tab = localStorage.getItem(ARCHIE_TAB_STORAGE_KEY) as ArchieCommandTab | null
      if (tab === 'skills' || tab === 'job_ready' || tab === 'certifications') {
        setArchieTab(tab)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, skillsRes, experienceRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/skills'),
          fetch('/api/work-experience'),
        ])

        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setProfile(profileData)
        }
        if (skillsRes.ok) {
          const skillsData = await skillsRes.json()
          setSkills(skillsData)
        }
        if (experienceRes.ok) {
          const experienceData = await experienceRes.json()
          setExperiences(experienceData)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const openRoadmapInNewTab = (roadmapId: string, mode: 'skills' | 'job_ready' | 'certifications') => {
    const path = `/dashboard/roadmap/${roadmapId}?mode=${mode}`
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  const loadRoadmapList = async () => {
    setRoadmapsLoading(true)
    setMigrationRequired(false)
    try {
      const res = await fetch('/api/learning-roadmaps')
      const data = (await res.json()) as {
        items?: LearningRoadmapMeta[]
        migration_required?: boolean
        error?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not load roadmaps')
      }
      const items = data.items || []
      setRoadmaps(items)
      if (data.migration_required) setMigrationRequired(true)

      const certCandidates = items.filter((r) => r.roadmap_kind === 'skills' || r.roadmap_kind === 'combined')
      setCertRoadmapId((prev) => {
        if (prev && items.some((i) => i.id === prev)) return prev
        return certCandidates[0]?.id ?? null
      })
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Could not load roadmaps')
    } finally {
      setRoadmapsLoading(false)
    }
  }

  useEffect(() => {
    if (!profile?.id) return
    void loadRoadmapList()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when user is known
  }, [profile?.id])

  useEffect(() => {
    if (!certRoadmapId) {
      setCertDetail(null)
      return
    }
    let cancel = false
    setCertLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/learning-roadmaps/${certRoadmapId}`)
        const data = (await res.json()) as LearningRoadmapDetail & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Could not load certifications')
        if (!cancel) setCertDetail(data)
      } catch {
        if (!cancel) setCertDetail(null)
      } finally {
        if (!cancel) setCertLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [certRoadmapId])

  useEffect(() => {
    if (!profile?.id) return
    void (async () => {
      try {
        const res = await fetch('/api/learning-syllabus')
        if (!res.ok) return
        const j = (await res.json()) as {
          hasSyllabus?: boolean
          charCount?: number
          filename?: string | null
          preview?: string
        }
        setSyllabusInfo({
          hasSyllabus: Boolean(j.hasSyllabus),
          charCount: typeof j.charCount === 'number' ? j.charCount : 0,
          filename: j.filename ?? null,
          preview: typeof j.preview === 'string' ? j.preview : '',
        })
      } catch {
        /* ignore */
      }
    })()
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    void (async () => {
      try {
        const res = await fetch('/api/learning-youtube-playlist')
        if (!res.ok) return
        const j = (await res.json()) as {
          hasPlaylist?: boolean
          charCount?: number
          videoCount?: number
          transcriptsOk?: number
          playlistUrl?: string | null
          preview?: string
        }
        setYoutubePlaylistInfo({
          hasPlaylist: Boolean(j.hasPlaylist),
          charCount: typeof j.charCount === 'number' ? j.charCount : 0,
          videoCount: typeof j.videoCount === 'number' ? j.videoCount : 0,
          transcriptsOk: typeof j.transcriptsOk === 'number' ? j.transcriptsOk : 0,
          playlistUrl: j.playlistUrl ?? null,
          preview: typeof j.preview === 'string' ? j.preview : '',
        })
      } catch {
        /* ignore */
      }
    })()
  }, [profile?.id])

  const uploadSyllabusPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please choose a PDF file')
      return
    }
    setSyllabusUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/learning-syllabus', { method: 'POST', body: fd })
      const j = (await res.json()) as { error?: string; charCount?: number; filename?: string; preview?: string }
      if (!res.ok) throw new Error(j.error || 'Upload failed')
      setSyllabusInfo({
        hasSyllabus: true,
        charCount: typeof j.charCount === 'number' ? j.charCount : 0,
        filename: j.filename ?? f.name,
        preview: typeof j.preview === 'string' ? j.preview : '',
      })
      toast.success('Syllabus saved — used as context when you build or refresh roadmaps')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSyllabusUploading(false)
    }
  }

  const saveYoutubePlaylistContext = async () => {
    const u = youtubePlaylistUrl.trim()
    if (!u) {
      toast.error('Paste a YouTube playlist link')
      return
    }
    setYoutubePlaylistLoading(true)
    try {
      const res = await fetch('/api/learning-youtube-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist_url: u }),
      })
      const j = (await res.json()) as {
        error?: string
        charCount?: number
        videoCount?: number
        transcriptsOk?: number
        playlistUrl?: string
        preview?: string
      }
      if (!res.ok) throw new Error(j.error || 'Could not process playlist')
      setYoutubePlaylistInfo({
        hasPlaylist: true,
        charCount: typeof j.charCount === 'number' ? j.charCount : 0,
        videoCount: typeof j.videoCount === 'number' ? j.videoCount : 0,
        transcriptsOk: typeof j.transcriptsOk === 'number' ? j.transcriptsOk : 0,
        playlistUrl: typeof j.playlistUrl === 'string' ? j.playlistUrl : u,
        preview: typeof j.preview === 'string' ? j.preview : '',
      })
      setYoutubePlaylistUrl('')
      toast.success('Playlist captions saved — Archie will use them when you build or refresh roadmaps')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Playlist import failed')
    } finally {
      setYoutubePlaylistLoading(false)
    }
  }

  const clearYoutubePlaylist = async () => {
    if (!confirm('Remove saved YouTube playlist context? Roadmaps already built stay as-is.')) return
    try {
      const res = await fetch('/api/learning-youtube-playlist', { method: 'DELETE' })
      const j = (await res.json()) as { error?: string; hint?: string }
      if (!res.ok) throw new Error(j.error || j.hint || 'Could not remove')
      setYoutubePlaylistInfo({
        hasPlaylist: false,
        charCount: 0,
        videoCount: 0,
        transcriptsOk: 0,
        playlistUrl: null,
        preview: '',
      })
      toast.success('Playlist context removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove')
    }
  }

  const clearSyllabus = async () => {
    if (!confirm('Remove the saved syllabus text? Roadmaps already generated are unchanged.')) return
    try {
      const res = await fetch('/api/learning-syllabus', { method: 'DELETE' })
      const j = (await res.json()) as { error?: string; hint?: string }
      if (!res.ok) throw new Error(j.error || j.hint || 'Could not remove syllabus')
      setSyllabusInfo({
        hasSyllabus: false,
        charCount: 0,
        filename: null,
        preview: '',
      })
      toast.success('Syllabus removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove')
    }
  }

  const persistArchieTab = (tab: ArchieCommandTab) => {
    setArchieTab(tab)
    try {
      localStorage.setItem(ARCHIE_TAB_STORAGE_KEY, tab)
    } catch {
      /* ignore */
    }
  }

  const createRoadmap = async () => {
    const t = targetRoleInput.trim()
    if (!t) {
      toast.error('Describe your goal or direction')
      return
    }
    setBuildLoading(true)
    setArchieError(null)
    try {
      const res = await fetch('/api/learning-roadmaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: t }),
      })
      const data = (await res.json()) as LearningRoadmapDetail & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Could not build roadmap')
      }
      const meta: LearningRoadmapMeta = {
        id: data.id,
        direction: data.direction,
        display_title: data.display_title,
        progress_percent: data.progress_percent,
        progress_skills_matched: data.progress_skills_matched,
        progress_skills_total: data.progress_skills_total,
        nodes_completed_skills: data.nodes_completed_skills,
        nodes_total_skills: data.nodes_total_skills,
        nodes_remaining_skills: data.nodes_remaining_skills,
        nodes_percent_skills: data.nodes_percent_skills,
        nodes_completed_job: data.nodes_completed_job,
        nodes_total_job: data.nodes_total_job,
        nodes_remaining_job: data.nodes_remaining_job,
        nodes_percent_job: data.nodes_percent_job,
        estimated_completion: data.estimated_completion,
        roadmap_kind: data.roadmap_kind ?? 'skills',
        recommended_job_title: data.recommended_job_title ?? null,
        linked_skills_roadmap_id: data.linked_skills_roadmap_id ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
      setRoadmaps((prev) => [meta, ...prev.filter((r) => r.id !== meta.id)])
      try {
        await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learning_direction: t }),
        })
      } catch {
        /* non-fatal */
      }
      setTargetRoleInput('')
      setBuildRoadmapDialogOpen(false)
      toast.success('Teaching roadmap saved — open it in a new tab anytime')
      openRoadmapInNewTab(meta.id, 'skills')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not build roadmap'
      setArchieError(msg)
      toast.error(msg)
    } finally {
      setBuildLoading(false)
    }
  }

  const createJobRoadmap = async () => {
    const t = jobTitleInput.trim()
    if (!t) {
      toast.error('Enter the role you are targeting')
      return
    }
    setJobBuildLoading(true)
    setArchieError(null)
    try {
      const res = await fetch('/api/learning-roadmaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: t,
          kind: 'job_ready',
          linked_skills_roadmap_id: linkedSkillsRoadmapId,
        }),
      })
      const data = (await res.json()) as LearningRoadmapDetail & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Could not build interview roadmap')
      }
      const meta: LearningRoadmapMeta = {
        id: data.id,
        direction: data.direction,
        display_title: data.display_title,
        progress_percent: data.progress_percent,
        progress_skills_matched: data.progress_skills_matched,
        progress_skills_total: data.progress_skills_total,
        nodes_completed_skills: data.nodes_completed_skills,
        nodes_total_skills: data.nodes_total_skills,
        nodes_remaining_skills: data.nodes_remaining_skills,
        nodes_percent_skills: data.nodes_percent_skills,
        nodes_completed_job: data.nodes_completed_job,
        nodes_total_job: data.nodes_total_job,
        nodes_remaining_job: data.nodes_remaining_job,
        nodes_percent_job: data.nodes_percent_job,
        estimated_completion: data.estimated_completion,
        roadmap_kind: data.roadmap_kind ?? 'job_ready',
        recommended_job_title: data.recommended_job_title ?? null,
        linked_skills_roadmap_id: data.linked_skills_roadmap_id ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      }
      setRoadmaps((prev) => [meta, ...prev.filter((r) => r.id !== meta.id)])
      setJobTitleInput('')
      setLinkedSkillsRoadmapId(null)
      setBuildJobDialogOpen(false)
      toast.success('Interview prep roadmap saved — opening in a new tab')
      openRoadmapInNewTab(meta.id, 'job_ready')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not build interview roadmap'
      setArchieError(msg)
      toast.error(msg)
    } finally {
      setJobBuildLoading(false)
    }
  }

  const saveTargetDate = async () => {
    if (!targetDateRoadmapId || !targetDateValue.trim()) {
      toast.error('Pick a target date')
      return
    }
    setTargetDateSaving(true)
    try {
      const res = await fetch(`/api/learning-roadmaps/${targetDateRoadmapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimated_completion: targetDateValue.trim() }),
      })
      const data = (await res.json()) as { error?: string; estimated_completion?: string; updated_at?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Could not update target date')
      }
      const eta = data.estimated_completion ?? targetDateValue.trim()
      const updatedAt = data.updated_at ?? new Date().toISOString()
      setRoadmaps((prev) =>
        prev.map((r) =>
          r.id === targetDateRoadmapId ? { ...r, estimated_completion: eta, updated_at: updatedAt } : r,
        ),
      )
      setTargetDateOpen(false)
      toast.success('Target date saved — weekly timeline rescaled to match')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update target date')
    } finally {
      setTargetDateSaving(false)
    }
  }

  const deleteRoadmap = async (id: string, e?: MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('Delete this saved roadmap?')) return
    try {
      const res = await fetch(`/api/learning-roadmaps/${id}`, { method: 'DELETE' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete')
      }
      setRoadmaps((prev) => {
        const rest = prev.filter((r) => r.id !== id)
        const certOpts = rest.filter((r) => r.roadmap_kind === 'skills' || r.roadmap_kind === 'combined')
        setCertRoadmapId((cid) => (cid === id ? certOpts[0]?.id ?? null : cid))
        return rest
      })
      toast.success('Roadmap removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  const clearDraftInput = () => {
    setTargetRoleInput('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Welcome to SkillCrew</CardTitle>
            <CardDescription>Please sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userName = profile.full_name || profile.email.split('@')[0]
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase()

  const skillsTrackRoadmaps = roadmaps.filter((r) => r.roadmap_kind === 'skills' || r.roadmap_kind === 'combined')
  const jobTrackRoadmaps = roadmaps.filter((r) => r.roadmap_kind === 'job_ready' || r.roadmap_kind === 'combined')
  const skillsSourcesForRecs = roadmaps.filter((r) => r.roadmap_kind === 'skills' || r.roadmap_kind === 'combined')
  const hasJobPrepForSkillsSource = (skillsId: string) =>
    roadmaps.some((j) => j.roadmap_kind === 'job_ready' && j.linked_skills_roadmap_id === skillsId)
  const certPickOptions = roadmaps.filter((r) => r.roadmap_kind === 'skills' || r.roadmap_kind === 'combined')

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
        {/* Welcome Section with User Profile */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="size-16 border-2 border-primary">
                <AvatarImage src={profile.avatar_url || undefined} alt={userName} />
                <AvatarFallback className="bg-primary/10 font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary/80 mb-1">Command center</p>
                <h1 className="text-3xl font-bold mb-1">Welcome back, {userName}!</h1>
                <p className="text-muted-foreground">
                  {skills.length} skills on file · {experiences.length} roles · Archie builds your path from here
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4 w-full lg:w-auto">
            <Card className="flex-1 lg:flex-none bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/20">
                  <Zap className="size-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total XP</p>
                  <p className="text-2xl font-bold">{profile.xp}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 lg:flex-none bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-500/20">
                  <Flame className="size-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <p className="text-2xl font-bold">{profile.streak} days</p>
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 lg:flex-none bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="flex size-12 items-center justify-center rounded-lg bg-amber-500/20">
                  <Award className="size-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="text-2xl font-bold">{profile.level}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Archie: tabs sit directly under the welcome row for fast navigation */}
        <section className="space-y-4">
          <Tabs value={archieTab} onValueChange={(v) => persistArchieTab(v as ArchieCommandTab)} className="gap-4">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-0">
              <TabsTrigger value="skills" className="gap-2 py-2.5 sm:py-1.5">
                <GraduationCap className="size-4 shrink-0" />
                Skills
              </TabsTrigger>
              <TabsTrigger value="job_ready" className="gap-2 py-2.5 sm:py-1.5">
                <Briefcase className="size-4 shrink-0" />
                Job ready
              </TabsTrigger>
              <TabsTrigger value="certifications" className="gap-2 py-2.5 sm:py-1.5">
                <Award className="size-4 shrink-0" />
                Certifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="skills" className="mt-4 space-y-4">
              {migrationRequired && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Database setup needed</CardTitle>
                    <CardDescription>
                      Run <code className="rounded bg-muted px-1 py-0.5 text-xs">frontend/scripts/005_user_archie_roadmaps.sql</code> and{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">frontend/scripts/007_roadmap_kind_split.sql</code> in the Supabase SQL
                      editor. Until then, the list may stay empty or lack Skills / Job split fields.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              <p className="text-sm text-muted-foreground max-w-3xl">
                Teaching roadmaps — what you want to <strong className="text-foreground font-medium">learn</strong>. Each card opens your saved path in a{' '}
                <strong className="text-foreground font-medium">new tab</strong> (this page stays fast).{' '}
                <Link href="/dashboard/chat" className="font-medium text-primary underline-offset-4 hover:underline">
                  Open chat
                </Link>{' '}
                to tune pace.
              </p>

              <Card className="border border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base">Build a personalized roadmap</CardTitle>
                  <CardDescription>
                    Enter what you want to learn and save a teaching roadmap that opens in its own tab.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="skills-build-input">What do you want to learn?</Label>
                    <Input
                      id="skills-build-input"
                      placeholder="e.g. Python machine learning, frontend architecture, data engineering…"
                      value={targetRoleInput}
                      onChange={(e) => setTargetRoleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void createRoadmap()}
                      disabled={migrationRequired}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void createRoadmap()}
                      disabled={migrationRequired || buildLoading}
                    >
                      {buildLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Building…
                        </>
                      ) : (
                        'Build roadmap'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBuildRoadmapDialogOpen(true)}
                      disabled={migrationRequired}
                    >
                      Advanced options
                    </Button>
                  </div>
                </CardContent>
              </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Your teaching roadmaps</h3>
              {roadmapsLoading && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="size-3.5 animate-spin" /> Syncing…
                </span>
              )}
            </div>
            {skillsTrackRoadmaps.length === 0 && !roadmapsLoading && !migrationRequired && (
              <p className="text-sm text-muted-foreground">
                No teaching roadmaps yet — use &quot;Build a personalized roadmap&quot; above.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {skillsTrackRoadmaps.map((r) => {
                return (
                  <Card
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openRoadmapInNewTab(r.id, 'skills')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openRoadmapInNewTab(r.id, 'skills')
                      }
                    }}
                    className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug line-clamp-2">{r.display_title}</CardTitle>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="Delete roadmap"
                          onClick={(e) => void deleteRoadmap(r.id, e)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <CardDescription className="line-clamp-2">{r.direction}</CardDescription>
                      <p className="text-[10px] text-muted-foreground">Opens teaching path in a new tab</p>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Path progress</span>
                          <span>
                            {typeof r.nodes_total_skills === 'number' && r.nodes_total_skills > 0
                              ? `${r.nodes_percent_skills ?? 0}%`
                              : '—'}
                          </span>
                        </div>
                        <Progress
                          value={
                            typeof r.nodes_total_skills === 'number' && r.nodes_total_skills > 0
                              ? (r.nodes_percent_skills ?? 0)
                              : 0
                          }
                          className="h-2"
                        />
                        {typeof r.nodes_total_skills === 'number' && r.nodes_total_skills > 0 ? (
                          <p className="text-[10px] text-muted-foreground">
                            {r.nodes_completed_skills ?? 0} of {r.nodes_total_skills} milestones completed ·{' '}
                            {r.nodes_remaining_skills ?? 0} remaining
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">
                            Complete weekly modules on the path to fill this bar
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-2">
                          <CalendarDays className="size-3.5 shrink-0" />
                          <span className="truncate">Target: {formatEta(r.estimated_completion)}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            setTargetDateRoadmapId(r.id)
                            setTargetDateValue((r.estimated_completion || '').slice(0, 10) || todayLocalYmd())
                            setTargetDateOpen(true)
                          }}
                        >
                          Set target
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <div>
            <Button
              type="button"
              disabled={migrationRequired}
              className="w-full sm:w-auto"
              onClick={() => setBuildRoadmapDialogOpen(true)}
            >
              Build a personalized roadmap
            </Button>

            <Dialog open={buildRoadmapDialogOpen} onOpenChange={setBuildRoadmapDialogOpen}>
              <DialogContent className="max-h-[min(90vh,720px)] w-full max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl">
                <DialogHeader>
                  <DialogTitle>Build a roadmap</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Save runs the AI once; we store your path. Optional PDF or YouTube playlist gives Archie extra teaching
                    context.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="target-role">Goal</Label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <Input
                        id="target-role"
                        placeholder="e.g. Full stack web dev, data analytics, nursing boards…"
                        value={targetRoleInput}
                        onChange={(e) => setTargetRoleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void createRoadmap()}
                        disabled={migrationRequired}
                        className="flex-1"
                      />
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" onClick={() => void createRoadmap()} disabled={migrationRequired || buildLoading}>
                          {buildLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Building…
                            </>
                          ) : (
                            'Save & build'
                          )}
                        </Button>
                        <Button type="button" variant="outline" onClick={clearDraftInput} disabled={buildLoading}>
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/70 pt-5">
                    <input
                      ref={syllabusFileRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      aria-label="Upload syllabus PDF"
                      onChange={(e) => void uploadSyllabusPdf(e)}
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-foreground">
                        Syllabus PDF <span className="font-normal text-muted-foreground">(optional)</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={syllabusUploading || migrationRequired}
                          onClick={() => syllabusFileRef.current?.click()}
                        >
                          {syllabusUploading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Parsing…
                            </>
                          ) : (
                            <>
                              <Upload className="size-4" /> Upload
                            </>
                          )}
                        </Button>
                        {syllabusInfo?.hasSyllabus && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => void clearSyllabus()}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                    {syllabusInfo?.hasSyllabus ? (
                      <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-xs text-muted-foreground">
                        <FileText className="size-3.5 shrink-0 opacity-80" />
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {syllabusInfo.filename || 'syllabus.pdf'}
                        </span>
                        <Badge variant="secondary" className="shrink-0 font-mono text-[10px] tabular-nums">
                          {syllabusInfo.charCount.toLocaleString()}
                        </Badge>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No PDF attached.</p>
                    )}
                  </div>

                  <div className="border-t border-border/70 pt-5">
                    <p className="text-sm font-medium text-foreground">
                      YouTube playlist <span className="font-normal text-muted-foreground">(optional)</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We expand the playlist, pull captions per video, and store the text for roadmap generation (can take a
                      minute).
                    </p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <Input
                        id="youtube-playlist-url"
                        type="url"
                        inputMode="url"
                        placeholder="https://www.youtube.com/playlist?list=…"
                        value={youtubePlaylistUrl}
                        onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void saveYoutubePlaylistContext()}
                        disabled={migrationRequired || youtubePlaylistLoading}
                        className="flex-1"
                      />
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={migrationRequired || youtubePlaylistLoading}
                          onClick={() => void saveYoutubePlaylistContext()}
                        >
                          {youtubePlaylistLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Fetching…
                            </>
                          ) : (
                            <>
                              <Youtube className="size-4" /> Add playlist
                            </>
                          )}
                        </Button>
                        {youtubePlaylistInfo?.hasPlaylist && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => void clearYoutubePlaylist()}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                    {youtubePlaylistInfo?.hasPlaylist ? (
                      <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-muted/25 px-2.5 py-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Youtube className="size-3.5 shrink-0 opacity-80" />
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                            {youtubePlaylistInfo.playlistUrl || 'Playlist'}
                          </span>
                          <Badge variant="secondary" className="shrink-0 font-mono text-[10px] tabular-nums">
                            {youtubePlaylistInfo.videoCount} videos · {youtubePlaylistInfo.charCount.toLocaleString()} chars
                          </Badge>
                        </div>
                        {youtubePlaylistInfo.transcriptsOk > 0 && (
                          <p className="text-muted-foreground">
                            Captions from {youtubePlaylistInfo.transcriptsOk} video
                            {youtubePlaylistInfo.transcriptsOk === 1 ? '' : 's'}
                          </p>
                        )}
                        {youtubePlaylistInfo.preview ? (
                          <p className="line-clamp-2 text-muted-foreground">{youtubePlaylistInfo.preview}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No playlist saved.</p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
            </TabsContent>

            <TabsContent value="job_ready" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground max-w-3xl">
                Interview and role readiness — <strong className="text-foreground font-medium">not</strong> a copy of your teaching syllabus. Suggestions appear from your teaching roadmaps; starting one is always your choice.
              </p>

              <Card className="border border-border bg-background">
                <CardHeader>
                  <CardTitle className="text-base">Build a personalized interview roadmap</CardTitle>
                  <CardDescription>
                    Enter the role you are targeting and save an interview prep roadmap that opens in a new tab.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="job-ready-target">Role you are targeting</Label>
                    <Input
                      id="job-ready-target"
                      placeholder="e.g. ML Engineer, Product Manager, Data Scientist…"
                      value={jobTitleInput}
                      onChange={(e) => setJobTitleInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void createJobRoadmap()}
                      disabled={migrationRequired}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void createJobRoadmap()}
                      disabled={migrationRequired || jobBuildLoading}
                    >
                      {jobBuildLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Building…
                        </>
                      ) : (
                        'Build interview roadmap'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setLinkedSkillsRoadmapId(null)
                        setBuildJobDialogOpen(true)
                      }}
                      disabled={migrationRequired}
                    >
                      Advanced options
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {skillsSourcesForRecs.filter((s) => !hasJobPrepForSkillsSource(s.id)).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Suggested interview prep</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {skillsSourcesForRecs
                      .filter((s) => !hasJobPrepForSkillsSource(s.id))
                      .map((s) => {
                        const suggested = s.recommended_job_title || inferRecommendedJobTitle(s.direction)
                        return (
                          <Card key={s.id} className="border-dashed">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">Try: {suggested}</CardTitle>
                              <CardDescription className="text-xs">Pairs with your topic: {s.display_title}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2 pt-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={migrationRequired}
                                onClick={() => {
                                  setJobTitleInput(suggested)
                                  setLinkedSkillsRoadmapId(s.id)
                                  setBuildJobDialogOpen(true)
                                }}
                              >
                                Begin interview roadmap
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Your interview roadmaps</h3>
                  {roadmapsLoading && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="size-3.5 animate-spin" /> Syncing…
                    </span>
                  )}
                </div>
                {jobTrackRoadmaps.length === 0 && !roadmapsLoading && !migrationRequired && (
                  <p className="text-sm text-muted-foreground">
                    No interview roadmaps yet — use a suggestion above or build your own.
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {jobTrackRoadmaps.map((r) => (
                    <Card
                      key={`job-${r.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRoadmapInNewTab(r.id, 'job_ready')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openRoadmapInNewTab(r.id, 'job_ready')
                        }
                      }}
                      className="cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-snug line-clamp-2">{r.display_title}</CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="Delete roadmap"
                            onClick={(e) => void deleteRoadmap(r.id, e)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {r.roadmap_kind === 'combined' ? 'Interview track (legacy combined save)' : r.direction}
                        </CardDescription>
                        <p className="text-[10px] text-muted-foreground">Opens interview prep in a new tab</p>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Path progress</span>
                            <span>
                              {typeof r.nodes_total_job === 'number' && r.nodes_total_job > 0
                                ? `${r.nodes_percent_job ?? 0}%`
                                : '—'}
                            </span>
                          </div>
                          <Progress
                            value={
                              typeof r.nodes_total_job === 'number' && r.nodes_total_job > 0
                                ? (r.nodes_percent_job ?? 0)
                                : 0
                            }
                            className="h-2"
                          />
                          {typeof r.nodes_total_job === 'number' && r.nodes_total_job > 0 ? (
                            <p className="text-[10px] text-muted-foreground">
                              {r.nodes_completed_job ?? 0} of {r.nodes_total_job} milestones completed ·{' '}
                              {r.nodes_remaining_job ?? 0} remaining
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">
                              Complete weekly modules on the path to fill this bar
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex min-w-0 items-center gap-2">
                            <CalendarDays className="size-3.5 shrink-0" />
                            <span className="truncate">Target: {formatEta(r.estimated_completion)}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setTargetDateRoadmapId(r.id)
                              setTargetDateValue((r.estimated_completion || '').slice(0, 10) || todayLocalYmd())
                              setTargetDateOpen(true)
                            }}
                          >
                            Set target
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  disabled={migrationRequired}
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setLinkedSkillsRoadmapId(null)
                    setJobTitleInput('')
                    setBuildJobDialogOpen(true)
                  }}
                >
                  Build a personalized interview roadmap
                </Button>

                <Dialog open={buildJobDialogOpen} onOpenChange={setBuildJobDialogOpen}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Interview roadmap</DialogTitle>
                      <DialogDescription>
                        Archie builds interview and role-readiness milestones for the title you enter — separate from your teaching roadmap.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-1">
                      <div className="space-y-2">
                        <Label htmlFor="job-target-title">Role you are targeting</Label>
                        <Input
                          id="job-target-title"
                          placeholder="e.g. ML Engineer, Product Manager…"
                          value={jobTitleInput}
                          onChange={(e) => setJobTitleInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && void createJobRoadmap()}
                          disabled={migrationRequired}
                        />
                      </div>
                      {linkedSkillsRoadmapId ? (
                        <p className="text-xs text-muted-foreground">
                          Linked to a Skills topic for your records. You can edit the role above freely.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setBuildJobDialogOpen(false)}
                          disabled={jobBuildLoading}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void createJobRoadmap()}
                          disabled={migrationRequired || jobBuildLoading}
                        >
                          {jobBuildLoading ? (
                            <>
                              <Loader2 className="size-4 animate-spin" /> Building…
                            </>
                          ) : (
                            'Save & build'
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="certifications" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground max-w-3xl">
                Certification ideas tied to your <strong className="text-foreground font-medium">teaching</strong> roadmaps. Choose which topic to display.
              </p>
              {certPickOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Create a Skills roadmap first to see credential suggestions.</p>
              ) : (
                <>
                  <div className="max-w-md space-y-2">
                    <Label htmlFor="cert-roadmap-pick">Teaching roadmap</Label>
                    <select
                      id="cert-roadmap-pick"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={certRoadmapId ?? ''}
                      onChange={(e) => setCertRoadmapId(e.target.value || null)}
                    >
                      {certPickOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.display_title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {certLoading && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Loading…
                    </p>
                  )}
                  {!certLoading && certDetail && (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => certRoadmapId && openRoadmapInNewTab(certRoadmapId, 'certifications')}
                      >
                        Open certifications in a new tab
                      </Button>
                      <ArchieCertificationsPanel bundle={certDetail.bundles.certifications} />
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

            <Dialog open={targetDateOpen} onOpenChange={setTargetDateOpen}>
              <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Roadmap target date</DialogTitle>
                  <DialogDescription>
                    We rescale the weekly syllabus (Skills & Job ready) to fit between today and your end date — no new AI
                    generation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="roadmap-target-date">Finish by</Label>
                    <Input
                      id="roadmap-target-date"
                      type="date"
                      min={todayLocalYmd()}
                      value={targetDateValue}
                      onChange={(e) => setTargetDateValue(e.target.value)}
                      disabled={targetDateSaving}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setTargetDateOpen(false)} disabled={targetDateSaving}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void saveTargetDate()} disabled={targetDateSaving}>
                      {targetDateSaving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Saving…
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

          {archieError && <p className="text-sm text-destructive">{archieError}</p>}
        </section>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-primary/5 via-transparent to-chart-2/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto flex-col py-4" asChild>
                <Link href="/dashboard/skills">
                  <Brain className="size-5 mb-2" />
                  <span className="text-xs text-center">Manage Skills</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col py-4" asChild>
                <Link href="/dashboard/experience">
                  <Briefcase className="size-5 mb-2" />
                  <span className="text-xs text-center">Work Experience</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col py-4" asChild>
                <Link href="/dashboard/revision">
                  <TrendingUp className="size-5 mb-2" />
                  <span className="text-xs text-center">Revision Lab</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto flex-col py-4" asChild>
                <Link href="/dashboard/settings">
                  <Settings className="size-5 mb-2" />
                  <span className="text-xs text-center">Settings</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
