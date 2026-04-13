'use client'

import React, { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, BookOpen, CheckCircle2, Zap } from 'lucide-react'

import { ModuleViewer } from '@/components/dashboard/module-viewer'
import { AssessmentViewer } from '@/components/dashboard/assessment-viewer'
import { KudosPopup, KudosQueue } from '@/components/dashboard/kudos-popup'
import { DynamicAdjustmentNotification } from '@/components/dashboard/dynamic-adjustment-notification'

import {
  assessmentService,
  moduleCompletionService,
  xpService,
  type AssessmentResult,
} from '@/lib/assessment-service'
import type { RoadmapModule, KudosMessage, DeepDiveModule } from '@/lib/assessment-types'

export default function RoadmapLearningPage() {
  const params = useParams()
  const roadmapId = params.roadmapId as string

  // State management
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0)
  const [modules, setModules] = useState<RoadmapModule[]>([])
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set())
  const [assessment, setAssessment] = useState<any>(null)
  const [assessmentQuestions, setAssessmentQuestions] = useState<any[]>([])
  const [dynamicAdjustments, setDynamicAdjustments] = useState<DeepDiveModule[]>([])
  const [kudosMessages, setKudosMessages] = useState<KudosMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [userStats, setUserStats] = useState({ xp: 0, rank: 0, totalPlayers: 0 })

  // Load initial data
  React.useEffect(() => {
    const loadRoadmapData = async () => {
      try {
        // TODO: Fetch modules from your roadmap API
        const mockModules: RoadmapModule[] = [
          {
            id: 'mod-1',
            title: 'Python Basics',
            description: 'Learn fundamental Python concepts',
            skills: ['Variables', 'Data Types', 'Basic Operations'],
            estimatedDuration: 60,
            sections: [
              {
                id: 'sec-1',
                title: 'Introduction to Variables',
                description: 'Understanding variables and data storage',
                resources: [
                  {
                    type: 'article',
                    title: 'Python Variables Guide',
                    url: 'https://example.com',
                    description: 'Comprehensive guide to Python variables',
                  },
                  {
                    type: 'video',
                    title: 'Variables Tutorial',
                    url: 'https://youtube.com/example',
                    duration: '15 mins',
                  },
                ],
              },
            ],
            completed: false,
            moduleIndex: 0,
            totalModules: 6,
            status: 'available',
          },
        ]
        setModules(mockModules)

        // Load user stats
        const stats = await xpService.getUserStats()
        setUserStats(stats)
      } catch (error) {
        console.error('Error loading roadmap:', error)
      }
    }

    loadRoadmapData()
  }, [roadmapId])

  const currentModule = modules[currentModuleIndex]

  // Handle module completion
  const handleModuleComplete = useCallback(
    async (moduleId: string, skillsLearned: string[]) => {
      try {
        setIsLoading(true)

        // Record completion
        await moduleCompletionService.recordModuleCompletion({
          roadmapId,
          moduleId,
          skillsLearned,
          timeSpentMinutes: 45,
        })

        // Update completed modules
        setCompletedModules(prev => new Set([...prev, moduleId]))

        // Add kudos
        addKudos({
          id: `kudos-${Date.now()}`,
          type: 'correct_answer',
          title: 'Module Completed! 🎉',
          message: `You've learned: ${skillsLearned.join(', ')}`,
          xpEarned: 50,
        })

        // Check if we should trigger assessment (every 2-3 modules)
        const completedCount = completedModules.size + 1
        if (completedCount % 3 === 0) {
          // Trigger assessment
          await triggerAssessment()
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error completing module:', error)
        setIsLoading(false)
      }
    },
    [roadmapId, completedModules]
  )

  // Trigger assessment
  const triggerAssessment = async () => {
    try {
      const { assessment: assessmentData, questions } = await assessmentService.generateAssessment({
        roadmapId,
        moduleIds: modules
          .slice(Math.max(0, currentModuleIndex - 2), currentModuleIndex + 1)
          .map(m => m.id),
        assessmentType: 'quiz',
        difficulty: 'easy',
        numQuestions: 5,
        moduleContent: {
          title: 'Module Assessment',
          description: 'Test your knowledge',
          skills: currentModule?.skills || [],
        },
      })

      setAssessment(assessmentData)
      setAssessmentQuestions(questions)
    } catch (error) {
      console.error('Error generating assessment:', error)
    }
  }

  // Handle assessment completion
  const handleAssessmentComplete = async (responses: Array<{ questionId: string; answer: string }>) => {
    try {
      setIsLoading(true)

      // Complete assessment
      const result = await assessmentService.completeAssessment({
        assessmentId: assessment.id,
        assessmentType: 'quiz',
        difficulty: 'easy',
      })

      // Award XP
      await xpService.awardXP({
        xpAmount: result.xp_earned,
        reason: `Assessment: ${result.score}% score`,
      })

      // Add kudos
      addKudos({
        id: `kudos-${Date.now()}`,
        type: result.score === 100 ? 'perfect_score' : 'correct_answer',
        title: result.score === 100 ? '🏆 Perfect Score!' : '✅ Assessment Passed!',
        message: `Score: ${result.score}%`,
        xpEarned: result.xp_earned,
      })

      // Handle roadmap adjustments
      if (result.roadmap_adjusted) {
        setDynamicAdjustments(result.deep_dive_modules)

        addKudos({
          id: `kudos-deep-dive-${Date.now()}`,
          type: 'deep_dive_added',
          title: '⚡ Deep Dive Module Added',
          message: `We've added focused learning modules to help you master this skill.`,
        })
      }

      // Update XP stats
      const newStats = await xpService.getUserStats()
      setUserStats(newStats)

      // Clear assessment
      setAssessment(null)
      setAssessmentQuestions([])

      setIsLoading(false)
    } catch (error) {
      console.error('Error completing assessment:', error)
      setIsLoading(false)
    }
  }

  // Add kudos message
  const addKudos = (message: KudosMessage) => {
    setKudosMessages(prev => [...prev, message])
  }

  if (!currentModule) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>Loading Roadmap...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header with XP and Stats */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Learning Roadmap</h1>
            <p className="text-muted-foreground mt-1">
              Module {currentModuleIndex + 1} of {modules.length}
            </p>
          </div>
          <Card className="w-fit">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 flex items-center gap-1">
                  <Zap className="w-6 h-6" />
                  {userStats.xp}
                </div>
                <p className="text-xs text-muted-foreground">XP</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <div className="text-2xl font-bold">#{userStats.rank}</div>
                <p className="text-xs text-muted-foreground">Leaderboard</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Adjustments Alert */}
        {dynamicAdjustments.length > 0 && (
          <DynamicAdjustmentNotification
            adjustments={dynamicAdjustments}
            onAcknowledge={() => {}}
            onStartDeepDive={() => {
              // Navigate to deep dive module
            }}
          />
        )}

        {/* Main Content Tabs */}
        <Tabs value={assessment ? 'assessment' : 'module'} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="module" disabled={!!assessment}>
              <BookOpen className="w-4 h-4 mr-2" />
              Module
            </TabsTrigger>
            <TabsTrigger value="assessment" disabled={!assessment}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Assessment {assessment && `(${assessmentQuestions.length} questions)`}
            </TabsTrigger>
          </TabsList>

          {/* Module Tab */}
          <TabsContent value="module" className="space-y-6">
            <ModuleViewer
              module={currentModule}
              onComplete={handleModuleComplete}
              isLoading={isLoading}
            />
          </TabsContent>

          {/* Assessment Tab */}
          <TabsContent value="assessment" className="space-y-6">
            {assessment && assessmentQuestions.length > 0 ? (
              <AssessmentViewer
                assessmentId={assessment.id}
                assessmentType={assessment.assessment_type || 'quiz'}
                difficulty={assessment.difficulty || 'easy'}
                questions={assessmentQuestions}
                onAnswerSubmit={async (questionId, answer) => {
                  // Handled by component
                }}
                onAssessmentComplete={handleAssessmentComplete}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Complete modules to unlock assessments
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Module Navigation */}
        {!assessment && (
          <div className="flex items-center justify-between gap-4 pt-4">
            <button
              onClick={() => setCurrentModuleIndex(Math.max(0, currentModuleIndex - 1))}
              disabled={currentModuleIndex === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/10"
            >
              ← Previous Module
            </button>

            <div className="text-sm text-muted-foreground">
              {completedModules.size} of {modules.length} modules completed
            </div>

            <button
              onClick={() => setCurrentModuleIndex(Math.min(modules.length - 1, currentModuleIndex + 1))}
              disabled={currentModuleIndex === modules.length - 1}
              className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/10"
            >
              Next Module →
            </button>
          </div>
        )}
      </div>

      {/* Kudos Queue */}
      <KudosQueue messages={kudosMessages} />
    </div>
  )
}
