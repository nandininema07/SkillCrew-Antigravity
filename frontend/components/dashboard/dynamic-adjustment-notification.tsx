'use client'

import React from 'react'
import { AlertCircle, BookOpen, Zap, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface DeepDiveModule {
  skill: string
  difficulty: 'easy' | 'medium' | 'hard'
  module_title: string
  description: string
  estimated_duration_minutes?: number
  content_sections?: Array<{
    section_title: string
    description: string
  }>
}

interface DynamicAdjustmentNotificationProps {
  adjustments: DeepDiveModule[]
  onAcknowledge: (skill: string) => void
  onStartDeepDive: (skill: string) => void
}

export const DynamicAdjustmentNotification: React.FC<DynamicAdjustmentNotificationProps> = ({
  adjustments,
  onAcknowledge,
  onStartDeepDive,
}) => {
  const [dismissedSkills, setDismissedSkills] = React.useState<Set<string>>(new Set())

  if (adjustments.length === 0 || adjustments.every(adj => dismissedSkills.has(adj.skill))) {
    return null
  }

  return (
    <div className="space-y-3 mb-6">
      {adjustments
        .filter(adj => !dismissedSkills.has(adj.skill))
        .map(adjustment => (
          <Alert key={adjustment.skill} className="border-l-4 border-l-blue-500 bg-blue-50">
            <Zap className="h-5 w-5 text-blue-600" />
            <div className="ml-2 flex-1">
              <AlertTitle className="text-blue-900 font-bold">
                Deep Dive Module Added: {adjustment.module_title}
              </AlertTitle>
              <AlertDescription className="text-blue-800 mt-1">
                We detected you struggled with <strong>{adjustment.skill}</strong> at the {adjustment.difficulty} level.
                This focused learning module will help you master the concept.
              </AlertDescription>

              {adjustment.estimated_duration_minutes && (
                <p className="text-sm text-blue-700 mt-2">
                  ⏱ Estimated time: {adjustment.estimated_duration_minutes} minutes
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => onStartDeepDive(adjustment.skill)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <BookOpen className="w-4 h-4 mr-1" />
                  Start Deep Dive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDismissedSkills(new Set([...dismissedSkills, adjustment.skill]))
                    onAcknowledge(adjustment.skill)
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
            <button
              onClick={() => setDismissedSkills(new Set([...dismissedSkills, adjustment.skill]))}
              className="text-blue-500 hover:text-blue-700 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </Alert>
        ))}
    </div>
  )
}
