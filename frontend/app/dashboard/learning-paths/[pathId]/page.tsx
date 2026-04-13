'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, BookOpen } from 'lucide-react'
import { generateContextualRoadmap } from '@/lib/learning-continuity'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface Module {
  id: string
  title: string
  description?: string
  skills?: string[]
  duration?: number
}

interface Roadmap {
  filtered_modules?: {
    skippable_modules?: Module[]
    new_modules?: Module[]
  }
  summary?: {
    learning_efficiency_boost?: number
  }
  contextual_roadmap?: string
  modules_sequence?: Module[]
}

export default function PathPage({ params }: { params: { pathId: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRoadmap = async () => {
      try {
        setLoading(true)
        
        // TODO: Get userId from auth session
        // TODO: Get path modules from database/API
        const userId = 'current-user-id'
        const modules: Module[] = [] // Get from getPathModules(params.pathId)

        const generatedRoadmap = await generateContextualRoadmap(
          userId,
          params.pathId,
          { skills: [], completedPaths: 0 },
          modules
        )

        setRoadmap(generatedRoadmap)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load roadmap'
        setError(errorMessage)
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadRoadmap()
  }, [params.pathId, toast])

  const handleEnrollModule = async (moduleId: string) => {
    try {
      // TODO: Implement module enrollment
      toast({
        title: 'Success',
        description: 'Module enrollment started',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enroll in module',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-muted-foreground">Loading your personalized roadmap...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg text-destructive">Error: {error}</div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-bold">Your Personalized Learning Path</h1>
        <p className="text-muted-foreground mt-2">
          Tailored based on your previous learning experience
        </p>
      </div>

      {/* Skippable Modules Alert */}
      {roadmap?.filtered_modules?.skippable_modules &&
        roadmap.filtered_modules.skippable_modules.length > 0 && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-900">
                  ✨ You already know {roadmap.filtered_modules.skippable_modules.length}{' '}
                  {roadmap.filtered_modules.skippable_modules.length === 1 ? 'module' : 'modules'}!
                </h3>
                <p className="text-sm text-green-800 mt-1">
                  We're skipping these to save you time. Estimated learning acceleration:{' '}
                  <strong>~{roadmap.summary?.learning_efficiency_boost || 0}%</strong>
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-green-700 hover:underline">
                    See skipped modules
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {roadmap.filtered_modules.skippable_modules.map((module) => (
                      <li key={module.id} className="text-sm text-green-700">
                        • {module.title}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          </div>
        )}

      {/* Nova Agent Recommendations */}
      {roadmap?.contextual_roadmap && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="w-full">
              <h3 className="font-semibold text-blue-900 mb-2">Nova's Recommendations</h3>
              <div className="bg-white p-3 rounded text-sm text-foreground whitespace-pre-wrap overflow-auto max-h-48">
                {roadmap.contextual_roadmap}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modules to Study */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Modules to Study</h2>

        {roadmap?.modules_sequence && roadmap.modules_sequence.length > 0 ? (
          <div className="grid gap-4">
            {roadmap.modules_sequence.map((module, index) => (
              <div
                key={module.id}
                className="p-4 border border-border rounded-lg hover:border-primary hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-semibold">{module.title}</h3>
                    </div>
                    {module.description && (
                      <p className="text-sm text-muted-foreground ml-8 mb-2">{module.description}</p>
                    )}
                    {module.skills && module.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 ml-8">
                        {module.skills.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                        {module.skills.length > 3 && (
                          <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                            +{module.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    {module.duration && (
                      <p className="text-xs text-muted-foreground mt-2 ml-8">
                        ⏱️ Est. {module.duration} minutes
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEnrollModule(module.id)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">No modules available for this path yet.</p>
          </div>
        )}
      </div>

      {/* Learning Path Summary */}
      <div className="mt-12 p-6 bg-accent rounded-lg">
        <h3 className="font-semibold mb-3">Learning Path Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Modules</p>
            <p className="text-xl font-bold">{roadmap?.modules_sequence?.length || 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Learning Boost</p>
            <p className="text-xl font-bold">~{roadmap?.summary?.learning_efficiency_boost || 0}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Modules to Skip</p>
            <p className="text-xl font-bold">
              {roadmap?.filtered_modules?.skippable_modules?.length || 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">New Modules</p>
            <p className="text-xl font-bold">
              {roadmap?.filtered_modules?.new_modules?.length || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
