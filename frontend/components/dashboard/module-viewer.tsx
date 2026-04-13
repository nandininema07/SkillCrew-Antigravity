'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Video, GraduationCap, Headphones, BookMarked, ExternalLink } from 'lucide-react'

export interface ContentResource {
  type: 'article' | 'video' | 'documentation' | 'book' | 'podcast'
  title: string
  url: string
  description?: string
  duration?: string
  source?: string
}

export interface ModuleSection {
  id: string
  title: string
  description: string
  resources: ContentResource[]
  estimatedTime?: number // in minutes
}

export interface RoadmapModule {
  id: string
  title: string
  description: string
  skills: string[]
  sections: ModuleSection[]
  estimatedDuration: number // in minutes
  completed: boolean
  moduleIndex: number
  totalModules: number
}

interface ModuleViewerProps {
  module: RoadmapModule
  onComplete: (moduleId: string, skillsLearned: string[]) => Promise<void>
  onAssessmentReady?: (moduleSectionCount: number) => void
  isLoading?: boolean
}

const getResourceIcon = (type: ContentResource['type']) => {
  switch (type) {
    case 'video':
      return <Video className="w-4 h-4" />
    case 'article':
      return <BookOpen className="w-4 h-4" />
    case 'documentation':
      return <GraduationCap className="w-4 h-4" />
    case 'book':
      return <BookMarked className="w-4 h-4" />
    case 'podcast':
      return <Headphones className="w-4 h-4" />
    default:
      return <BookOpen className="w-4 h-4" />
  }
}

const getResourceLabel = (type: ContentResource['type']) => {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
}

export const ModuleViewer: React.FC<ModuleViewerProps> = ({
  module,
  onComplete,
  onAssessmentReady,
  isLoading = false,
}) => {
  const [isCompleted, setIsCompleted] = useState(module.completed)
  const [completingModule, setCompletingModule] = useState(false)
  const [resourcesExpanded, setResourcesExpanded] = useState<Record<string, boolean>>({})

  const handleCompleteModule = async () => {
    setCompletingModule(true)
    try {
      await onComplete(module.id, module.skills)
      setIsCompleted(true)

      // Check if we should trigger assessment (every 2-3 modules)
      if (module.moduleIndex > 0 && (module.moduleIndex + 1) % 3 === 0) {
        onAssessmentReady?.(module.moduleIndex + 1)
      }
    } catch (error) {
      console.error('Error completing module:', error)
    } finally {
      setCompletingModule(false)
    }
  }

  const toggleResourcesExpanded = (sectionId: string) => {
    setResourcesExpanded(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <Card className="border-blue-100 bg-blue-50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={isCompleted ? 'default' : 'secondary'}>
                  Module {module.moduleIndex + 1} / {module.totalModules}
                </Badge>
                {isCompleted && <Badge variant="default" className="bg-green-500">Completed</Badge>}
              </div>
              <CardTitle className="text-2xl">{module.title}</CardTitle>
              <CardDescription className="mt-2">{module.description}</CardDescription>
            </div>
          </div>

          {/* Module Meta */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div>
              <span className="text-sm font-medium text-gray-600">Estimated Duration</span>
              <p className="text-lg font-bold text-gray-900">{module.estimatedDuration} mins</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Skills You'll Learn</span>
              <div className="flex gap-2 mt-1 flex-wrap">
                {module.skills.map(skill => (
                  <Badge key={skill} variant="outline" className="bg-white">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Module Sections & Content */}
      <div className="space-y-4">
        {module.sections.map((section, sectionIdx) => (
          <Card key={section.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {sectionIdx + 1}. {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resources for this section */}
              <div>
                <button
                  onClick={() => toggleResourcesExpanded(section.id)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-3"
                >
                  <span>
                    {resourcesExpanded[section.id] ? '▼' : '▶'} Learning Resources
                  </span>
                  <Badge variant="outline">{section.resources.length}</Badge>
                </button>

                {resourcesExpanded[section.id] && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-5">
                    {section.resources.map((resource, idx) => (
                      <a
                        key={idx}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 text-gray-500 group-hover:text-blue-600 transition-colors">
                            {getResourceIcon(resource.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                              {resource.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getResourceLabel(resource.type)}
                              {resource.duration && ` • ${resource.duration}`}
                              {resource.source && ` • ${resource.source}`}
                            </p>
                            {resource.description && (
                              <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                                {resource.description}
                              </p>
                            )}
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Completion Section */}
      <Card className={`border-2 ${isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
        <CardHeader>
          <CardTitle className="text-lg">Module Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 border rounded-lg bg-white">
            <Checkbox
              id={`complete-${module.id}`}
              checked={isCompleted}
              disabled={completingModule || isLoading}
              onCheckedChange={() => {
                if (!isCompleted) {
                  handleCompleteModule()
                }
              }}
            />
            <label
              htmlFor={`complete-${module.id}`}
              className={`text-sm font-medium cursor-pointer flex-1 ${
                isCompleted ? 'text-green-700' : 'text-gray-700'
              }`}
            >
              {isCompleted ? '✓ Module Completed' : 'Mark as completed'}
            </label>
          </div>

          {isCompleted && (
            <div className="p-4 bg-green-100 text-green-800 rounded-lg text-sm">
              <p className="font-medium mb-1">Great job! 🎉</p>
              <p>You've mastered: {module.skills.join(', ')}</p>
              {module.moduleIndex > 0 && (module.moduleIndex + 1) % 3 === 0 && (
                <p className="mt-2 text-green-900">
                  An assessment is ready for you. Move to the next section to take it!
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleCompleteModule}
            disabled={isCompleted || completingModule || isLoading}
            className="w-full"
            size="lg"
          >
            {completingModule ? 'Completing...' : isCompleted ? 'Module Completed' : 'Complete Module'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
