'use client'

import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import {
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Clock,
  Search,
  Filter,
} from 'lucide-react'
import { recordModuleCompletion } from '@/lib/learning-continuity'

export default function ModulesPage() {
  const { currentPath } = useAppStore()

  if (!currentPath) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>No Active Learning Path</CardTitle>
            <CardDescription>Complete onboarding to get started</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const modulesByStatus = {
    completed: currentPath.modules.filter(m => m.status === 'completed'),
    inProgress: currentPath.modules.filter(m => m.status === 'in-progress'),
    available: currentPath.modules.filter(m => m.status === 'available'),
    locked: currentPath.modules.filter(m => m.status === 'locked'),
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Page Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
              <BookOpen className="size-8" />
              Learning Modules
            </h1>
            <p className="text-muted-foreground">
              {currentPath.title}
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search modules..." className="pl-10" />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="size-4" />
              Filter
            </Button>
          </div>
        </div>

        {/* Overall Progress */}
        <Card className="bg-gradient-to-r from-primary/5 to-chart-2/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Path Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {modulesByStatus.completed.length} of {currentPath.modules.length} completed
              </span>
              <span className="font-bold">{Math.round(currentPath.progress)}%</span>
            </div>
            <Progress value={currentPath.progress} className="h-2" />
          </CardContent>
        </Card>

        {/* In Progress Section */}
        {modulesByStatus.inProgress.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <div className="size-2 rounded-full bg-primary animate-pulse" />
              Continue Learning
            </h2>
            <div className="grid gap-4">
              {modulesByStatus.inProgress.map((module) => (
                <Link key={module.id} href={`/dashboard/modules/${module.id}`}>
                  <Card className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">
                            {module.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {module.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {module.estimatedTime}
                            </div>
                            <div className="flex gap-1">
                              {module.skills.map((skill) => (
                                <Badge key={skill} variant="outline" className="text-[10px]">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-bold">{module.progress}%</span>
                            </div>
                            <Progress value={module.progress} className="h-1.5" />
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Available Section */}
        {modulesByStatus.available.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Available Modules</h2>
            <div className="grid gap-4">
              {modulesByStatus.available.map((module) => (
                <Link key={module.id} href={`/dashboard/modules/${module.id}`}>
                  <Card className="group cursor-pointer transition-all hover:shadow-lg hover:border-primary/50">
                    <CardContent className="pt-6">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold group-hover:text-primary transition-colors mb-1">
                            {module.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {module.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {module.estimatedTime}
                            </div>
                            <div className="flex gap-1">
                              {module.skills.map((skill) => (
                                <Badge key={skill} variant="outline" className="text-[10px]">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center justify-center">
                          <span className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-transform group-hover:translate-x-1">
                            Start
                            <ArrowRight className="size-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Completed Section */}
        {modulesByStatus.completed.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              Completed Modules
            </h2>
            <div className="grid gap-4">
              {modulesByStatus.completed.map((module) => (
                <Card key={module.id} className="opacity-75">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 line-through text-muted-foreground">
                          {module.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {module.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {module.estimatedTime}
                          </div>
                          <div className="flex gap-1">
                            {module.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <CheckCircle2 className="size-6 text-green-500" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Locked Section */}
        {modulesByStatus.locked.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Lock className="size-5 text-muted-foreground" />
              Locked Modules
            </h2>
            <div className="grid gap-4">
              {modulesByStatus.locked.map((module) => (
                <Card key={module.id} className="opacity-60">
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-muted-foreground">
                          {module.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {module.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {module.estimatedTime}
                          </div>
                          <div className="flex gap-1">
                            {module.skills.map((skill) => (
                              <Badge key={skill} variant="outline" className="text-[10px]">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <Lock className="size-6 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
