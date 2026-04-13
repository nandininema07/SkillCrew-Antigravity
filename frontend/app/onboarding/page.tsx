'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { AgentAvatar } from '@/components/agents'
import { agents } from '@/lib/agents'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import {
  Sparkles,
  Upload,
  Linkedin,
  Link as LinkIcon,
  CheckCircle2,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  Target,
  Briefcase,
  Award,
  Loader2,
} from 'lucide-react'
import type { Skill } from '@/lib/types'

const mockSkills: Skill[] = [
  { id: '1', name: 'JavaScript', level: 'intermediate', confidence: 0.85, lastUpdated: new Date() },
  { id: '2', name: 'React', level: 'intermediate', confidence: 0.78, lastUpdated: new Date() },
  { id: '3', name: 'TypeScript', level: 'beginner', confidence: 0.65, lastUpdated: new Date() },
  { id: '4', name: 'Node.js', level: 'beginner', confidence: 0.60, lastUpdated: new Date() },
  { id: '5', name: 'CSS', level: 'advanced', confidence: 0.90, lastUpdated: new Date() },
  { id: '6', name: 'HTML', level: 'expert', confidence: 0.95, lastUpdated: new Date() },
  { id: '7', name: 'Git', level: 'intermediate', confidence: 0.75, lastUpdated: new Date() },
  { id: '8', name: 'REST APIs', level: 'intermediate', confidence: 0.72, lastUpdated: new Date() },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { setExtractedSkills, setSelectedGoal, setUser, setCurrentPath } = useAppStore()
  
  const [step, setStep] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [newSkill, setNewSkill] = useState('')
  const [goal, setGoal] = useState<'skill-mastery' | 'job-readiness' | 'certification' | null>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }, [])

  const handleExtract = useCallback(() => {
    setIsProcessing(true)
    // Simulate extraction process
    setTimeout(() => {
      setSkills(mockSkills)
      setSelectedSkills(new Set(mockSkills.map(s => s.id)))
      setIsProcessing(false)
      setStep(1)
    }, 2500)
  }, [])

  const toggleSkill = useCallback((skillId: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }, [])

  const addCustomSkill = useCallback(() => {
    if (!newSkill.trim()) return
    const skill: Skill = {
      id: `custom-${Date.now()}`,
      name: newSkill.trim(),
      level: 'beginner',
      confidence: 0.5,
      lastUpdated: new Date(),
    }
    setSkills(prev => [...prev, skill])
    setSelectedSkills(prev => new Set([...prev, skill.id]))
    setNewSkill('')
  }, [newSkill])

  const handleConfirmSkills = useCallback(() => {
    const confirmed = skills.filter(s => selectedSkills.has(s.id))
    setExtractedSkills(confirmed)
    setStep(2)
  }, [skills, selectedSkills, setExtractedSkills])

  const handleSelectGoal = useCallback((selectedGoal: typeof goal) => {
    setGoal(selectedGoal)
  }, [])

  const handleComplete = useCallback(() => {
    if (!goal) return
    
    setSelectedGoal(goal)
    setIsProcessing(true)

    // Simulate path generation
    setTimeout(async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const email = authUser?.email ?? ''
      const meta = authUser?.user_metadata as { full_name?: string } | undefined
      const displayName =
        (meta?.full_name && String(meta.full_name).trim()) ||
        (email ? email.split('@')[0] : 'Learner')

      setUser({
        id: authUser?.id ?? crypto.randomUUID(),
        name: displayName,
        email: email || '—',
        skills: skills.filter(s => selectedSkills.has(s.id)),
        xp: 0,
        level: 1,
        streak: 0,
        badges: [],
      })

      setCurrentPath({
        id: 'path-1',
        title: goal === 'skill-mastery' 
          ? 'Full-Stack Development Mastery'
          : goal === 'job-readiness'
          ? 'Job-Ready Developer Path'
          : 'AWS Certification Prep',
        goal,
        modules: [
          {
            id: 'mod-1',
            title: 'JavaScript Fundamentals',
            description: 'Master the core concepts of JavaScript',
            status: 'available',
            progress: 0,
            estimatedTime: '2 hours',
            skills: ['JavaScript'],
            agentId: 'dexter',
          },
          {
            id: 'mod-2',
            title: 'React Essentials',
            description: 'Build interactive UIs with React',
            status: 'locked',
            progress: 0,
            estimatedTime: '3 hours',
            skills: ['React'],
            agentId: 'dexter',
          },
          {
            id: 'mod-3',
            title: 'TypeScript Deep Dive',
            description: 'Add type safety to your JavaScript',
            status: 'locked',
            progress: 0,
            estimatedTime: '2.5 hours',
            skills: ['TypeScript'],
            agentId: 'dexter',
          },
        ],
        progress: 0,
        startedAt: new Date(),
        estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      router.push('/dashboard')
    }, 2000)
  }, [goal, skills, selectedSkills, setSelectedGoal, setUser, setCurrentPath, router])

  const steps = [
    { title: 'Profile', description: 'Share your background' },
    { title: 'Skills', description: 'Verify your skills' },
    { title: 'Goal', description: 'Choose your path' },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Agent Guidance */}
      <div className="hidden lg:flex w-96 flex-col border-r bg-card/50 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold">SkillCrew</h1>
            <p className="text-xs text-muted-foreground">Onboarding</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AgentAvatar agentId="nova" size="xl" active showGlow />
          <h2 className="mt-6 text-xl font-semibold">{agents.nova.name}</h2>
          <p className="text-sm text-primary mb-2">{agents.nova.role}</p>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs">
            {step === 0 && "Hi! I'm Nova. I'll help you get started by analyzing your background and extracting your skills."}
            {step === 1 && "Great! I've identified your skills. Please verify them and add any I might have missed."}
            {step === 2 && "Perfect! Now let's define your learning goal so Archie can design your personalized path."}
          </p>

          <div className="w-full space-y-3">
            {steps.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                  i === step && "bg-primary/10 border border-primary/20",
                  i < step && "text-muted-foreground",
                  i > step && "text-muted-foreground/50"
                )}
              >
                <div className={cn(
                  "size-8 rounded-full flex items-center justify-center text-sm font-medium",
                  i < step && "bg-green-500/20 text-green-500",
                  i === step && "bg-primary text-primary-foreground",
                  i > step && "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t">
          <Progress value={(step / 2) * 100} className="h-1" />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Step {step + 1} of 3
          </p>
        </div>
      </div>

      {/* Right Panel - Content */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-xl">
          {/* Step 0: Profile Upload */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold mb-2">Let&apos;s Get Started</h1>
                <p className="text-muted-foreground">
                  Connect your LinkedIn or upload your resume so I can understand your background.
                </p>
              </div>

              <div className="grid gap-4">
                <Card className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  linkedinUrl && "border-primary bg-primary/5"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <Linkedin className="size-5 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">LinkedIn Profile</CardTitle>
                        <CardDescription>Import from your public profile</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          placeholder="linkedin.com/in/yourprofile"
                          value={linkedinUrl}
                          onChange={(e) => setLinkedinUrl(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Card className={cn(
                  "cursor-pointer transition-all hover:border-primary/50",
                  uploadedFile && "border-primary bg-primary/5"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                        <Upload className="size-5 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Upload Resume</CardTitle>
                        <CardDescription>PDF, DOCX, or TXT (max 5MB)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                      {uploadedFile ? (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="size-4 text-green-500" />
                          <span>{uploadedFile.name}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              setUploadedFile(null)
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="size-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Click or drag to upload
                          </span>
                        </>
                      )}
                    </label>
                  </CardContent>
                </Card>
              </div>

              <Button
                onClick={handleExtract}
                disabled={!linkedinUrl && !uploadedFile}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Nova is analyzing...
                  </>
                ) : (
                  <>
                    Extract Skills
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 1: Skill Verification */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold mb-2">Verify Your Skills</h1>
                <p className="text-muted-foreground">
                  I found {skills.length} skills in your profile. Confirm them and add any I missed.
                </p>
              </div>

              <div className="space-y-3">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      selectedSkills.has(skill.id)
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/30 border-muted"
                    )}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <Checkbox
                      checked={selectedSkills.has(skill.id)}
                      onCheckedChange={() => toggleSkill(skill.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{skill.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {skill.level}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(skill.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Add a skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomSkill()}
                />
                <Button variant="outline" onClick={addCustomSkill}>
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(0)}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={handleConfirmSkills}
                  disabled={selectedSkills.size === 0}
                  className="flex-1"
                >
                  Confirm {selectedSkills.size} Skills
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Goal Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold mb-2">Choose Your Goal</h1>
                <p className="text-muted-foreground">
                  What would you like to achieve? This helps Archie design the perfect path.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    id: 'skill-mastery' as const,
                    icon: Target,
                    title: 'Skill Mastery',
                    description: 'Deep dive into specific skills and become an expert',
                    color: 'text-primary',
                    bg: 'bg-primary/10',
                  },
                  {
                    id: 'job-readiness' as const,
                    icon: Briefcase,
                    title: 'Job Readiness',
                    description: 'Prepare for interviews and land your dream role',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-500/10',
                  },
                  {
                    id: 'certification' as const,
                    icon: Award,
                    title: 'Certification',
                    description: 'Study for industry certifications and credentials',
                    color: 'text-amber-500',
                    bg: 'bg-amber-500/10',
                  },
                ].map((item) => (
                  <Card
                    key={item.id}
                    onClick={() => handleSelectGoal(item.id)}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      goal === item.id && "border-primary bg-primary/5"
                    )}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className={cn("flex size-12 items-center justify-center rounded-xl", item.bg)}>
                        <item.icon className={cn("size-6", item.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <div className={cn(
                        "size-5 rounded-full border-2 transition-all",
                        goal === item.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30"
                      )}>
                        {goal === item.id && (
                          <CheckCircle2 className="size-4 text-primary-foreground m-auto" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={!goal || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Archie is building your path...
                    </>
                  ) : (
                    <>
                      Start Learning
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
