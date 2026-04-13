'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { recordModuleCompletion } from '@/lib/learning-continuity'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert } from '@/components/ui/alert'
import { AgentAvatar } from '@/components/agents/agent-avatar'
import { agents } from '@/lib/agents'
import { useAppStore } from '@/lib/store'
import {
  BookOpen,
  CheckCircle2,
  Play,
  FileText,
  Video,
  Code,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  Clock,
  Award,
  Zap,
  AlertCircle,
} from 'lucide-react'

export default function ModuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { currentPath, updateModuleProgress } = useAppStore()
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('content')
  const [isCompleting, setIsCompleting] = useState(false)
  const [moduleStartTime] = useState<number>(Date.now())

  const moduleId = params.id as string
  const module = currentPath?.modules.find(m => m.id === moduleId)

  if (!module) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Module Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/modules">Back to Modules</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const agent = agents[module.agentId]
  const progress = completedSections.size

  const sections = [
    {
      id: 'intro',
      title: 'Introduction',
      description: 'Overview and learning objectives',
      icon: BookOpen,
      content: 'Start with the fundamentals and understand what you&apos;ll be learning in this module.',
    },
    {
      id: 'concepts',
      title: 'Core Concepts',
      description: '5 key concepts you need to master',
      icon: FileText,
      content: 'Dive into the core concepts that form the foundation of this skill.',
    },
    {
      id: 'video',
      title: 'Video Tutorial',
      description: 'Step-by-step walkthrough',
      icon: Video,
      content: 'Watch a comprehensive video guide covering all the important aspects.',
    },
    {
      id: 'practice',
      title: 'Practice Exercises',
      description: 'Hands-on coding challenges',
      icon: Code,
      content: 'Apply what you&apos;ve learned through interactive coding exercises.',
    },
    {
      id: 'quiz',
      title: 'Knowledge Check',
      description: 'Test your understanding',
      icon: Award,
      content: 'Complete a quiz to verify your mastery of the material.',
    },
  ]

  const toggleSection = (sectionId: string) => {
    const newCompleted = new Set(completedSections)
    if (newCompleted.has(sectionId)) {
      newCompleted.delete(sectionId)
    } else {
      newCompleted.add(sectionId)
    }
    setCompletedSections(newCompleted)
    updateModuleProgress(module.id, Math.round((newCompleted.size / sections.length) * 100))
  }

  const handleCompleteModule = async () => {
    if (!currentPath || !module) return

    try {
      setIsCompleting(true)

      // Get user ID from store (you may need to adjust based on your auth setup)
      const userId = currentPath.id || 'test-user' // Placeholder - adjust as needed

      // Calculate metrics
      const timeSpentMinutes = Math.round((Date.now() - moduleStartTime) / 60000)
      const performanceScore = Math.min(100, 85 + (completedSections.size / sections.length * 15)) // 85-100 based on completion
      const skillsAcquired = module.skills || []

      // Record completion
      const result = await recordModuleCompletion({
        userId,
        moduleId: module.id,
        pathId: currentPath.id,
        timeSpentMinutes: Math.max(1, timeSpentMinutes),
        performanceScore: Math.round(performanceScore),
        skillsAcquired,
      })

      toast({
        title: 'Module Completed! 🎉',
        description: `Great job! You've earned ${skillsAcquired.length} new skills and ${Math.round(performanceScore)} points.`,
      })

      // Redirect to modules list to show updated state
      setTimeout(() => {
        router.push('/dashboard/modules')
      }, 1500)
    } catch (error) {
      console.error('Error completing module:', error)
      toast({
        title: 'Error',
        description: 'Failed to save module completion. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/dashboard/modules" className="gap-1">
              <ArrowLeft className="size-4" />
              Back to Modules
            </Link>
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{module.title}</h1>
            <p className="text-muted-foreground">{module.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm">{module.estimatedTime}</span>
            </div>
            <div className="flex items-center gap-2">
              {module.skills.map((skill) => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Module Progress</span>
            <span className="text-muted-foreground">{progress} of {sections.length} sections</span>
          </div>
          <Progress value={(progress / sections.length) * 100} className="h-2" />
        </div>

        {/* Agent Guidance */}
        <Card className="bg-gradient-to-r from-primary/10 to-chart-2/10 border-primary/20">
          <CardContent className="pt-6 flex gap-4">
            <AgentAvatar agentId={agent.id} size="lg" showGlow={false} />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{agent.name} is here to help</h3>
              <p className="text-sm text-muted-foreground">
                {agent.description} I&apos;m available throughout this module to answer questions and provide guidance.
              </p>
              <Button size="sm" variant="outline" className="mt-3 gap-2">
                <MessageSquare className="size-4" />
                Ask {agent.name}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="size-5" />
                  Learning Content
                </CardTitle>
                <CardDescription>Complete each section to progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sections.map((section) => {
                  const Icon = section.icon
                  const isCompleted = completedSections.has(section.id)

                  return (
                    <div
                      key={section.id}
                      className={cn(
                        'border rounded-lg p-4 transition-all cursor-pointer hover:bg-muted/30',
                        isCompleted && 'bg-green-500/5 border-green-500/30'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className={cn(
                            'flex size-10 items-center justify-center rounded-lg',
                            isCompleted
                              ? 'bg-green-500/20 text-green-600'
                              : 'bg-primary/10 text-primary'
                          )}>
                            {isCompleted ? (
                              <CheckCircle2 className="size-5" />
                            ) : (
                              <Icon className="size-5" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className={cn(
                            'font-semibold mb-1',
                            isCompleted && 'line-through text-muted-foreground'
                          )}>
                            {section.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            {section.description}
                          </p>
                          <p className="text-sm mb-4">{section.content}</p>
                          <Button
                            size="sm"
                            onClick={() => toggleSection(section.id)}
                            variant={isCompleted ? 'outline' : 'default'}
                          >
                            {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  Learning Resources
                </CardTitle>
                <CardDescription>Curated materials to support your learning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    title: 'Official Documentation',
                    type: 'documentation',
                    source: 'MDN Web Docs',
                    duration: '30 min read',
                    difficulty: 'intermediate',
                  },
                  {
                    title: 'Interactive Tutorial',
                    type: 'interactive',
                    source: 'freeCodeCamp',
                    duration: '45 min',
                    difficulty: 'beginner',
                  },
                  {
                    title: 'Advanced Guide',
                    type: 'article',
                    source: 'Dev.to',
                    duration: '20 min read',
                    difficulty: 'advanced',
                  },
                  {
                    title: 'Video Series',
                    type: 'video',
                    source: 'YouTube',
                    duration: '2 hours',
                    difficulty: 'intermediate',
                  },
                ].map((resource, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-between h-auto p-4 text-left"
                    asChild
                  >
                    <a href="#" target="_blank" rel="noopener noreferrer">
                      <div className="flex-1">
                        <p className="font-medium">{resource.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{resource.source}</span>
                          <span>•</span>
                          <span>{resource.duration}</span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {resource.difficulty}
                          </Badge>
                        </div>
                      </div>
                      <ArrowRight className="size-4 flex-shrink-0 ml-2" />
                    </a>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard/modules" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          
          {/* Complete Module Button */}
          <Button 
            onClick={handleCompleteModule}
            disabled={completedSections.size < sections.length || isCompleting}
            className="ml-auto gap-2"
          >
            {isCompleting ? (
              <>
                <Zap className="size-4 animate-spin" />
                Completing...
              </>
            ) : completedSections.size === sections.length ? (
              <>
                <CheckCircle2 className="size-4" />
                Complete Module
              </>
            ) : (
              <>
                <Award className="size-4" />
                Complete {sections.length - completedSections.size} more sections
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
