'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Linkedin,
  LinkIcon,
  Loader2,
  CheckCircle2,
  Sparkles,
  Brain,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBSkill } from '@/lib/database.types'

const levelColors = {
  beginner: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  intermediate: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  advanced: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  expert: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
}

export default function SkillsManagementPage() {
  const [skills, setSkills] = useState<DBSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractedSkills, setExtractedSkills] = useState<DBSkill[]>([])
  const [linkedinWarning, setLinkedinWarning] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSkill, setEditingSkill] = useState<DBSkill | null>(null)
  const [newSkill, setNewSkill] = useState({
    name: '',
    level: 'beginner' as DBSkill['level'],
    confidence: 50,
  })

  const fetchSkills = useCallback(async () => {
    try {
      const response = await fetch('/api/skills')
      if (response.ok) {
        const data = await response.json()
        setSkills(data)
      }
    } catch (error) {
      console.error('Error fetching skills:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleAddSkill = async () => {
    if (!newSkill.name.trim()) {
      toast.error('Please enter a skill name')
      return
    }

    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSkill.name,
          level: newSkill.level,
          confidence: newSkill.confidence / 100,
          source: 'manual',
        }),
      })

      if (response.ok) {
        toast.success('Skill added successfully')
        setNewSkill({ name: '', level: 'beginner', confidence: 50 })
        setShowAddDialog(false)
        fetchSkills()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add skill')
      }
    } catch {
      toast.error('Failed to add skill')
    }
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill) return

    try {
      const response = await fetch(`/api/skills/${editingSkill.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingSkill.name,
          level: editingSkill.level,
          confidence: editingSkill.confidence,
        }),
      })

      if (response.ok) {
        toast.success('Skill updated successfully')
        setEditingSkill(null)
        fetchSkills()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update skill')
      }
    } catch {
      toast.error('Failed to update skill')
    }
  }

  const handleDeleteSkill = async (id: string) => {
    try {
      const response = await fetch(`/api/skills/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Skill deleted')
        fetchSkills()
      }
    } catch {
      toast.error('Failed to delete skill')
    }
  }

  const handleExtractFromLinkedIn = async () => {
    if (!linkedinUrl.trim()) {
      toast.error('Please enter a LinkedIn URL')
      return
    }

    setExtracting(true)
    setLinkedinWarning(null)
    try {
      const response = await fetch('/api/skills/extract-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: linkedinUrl.trim() }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to extract skills from LinkedIn')
        return
      }

      setExtractedSkills(data.skills ?? [])
      if (typeof data.warning === 'string' && data.warning) {
        setLinkedinWarning(data.warning)
        toast.warning('LinkedIn import notice', { description: data.warning.slice(0, 280) })
      }
      toast.success(data.message || `Found ${(data.skills ?? []).length} skills`)
    } catch {
      toast.error('Failed to extract skills from LinkedIn')
    } finally {
      setExtracting(false)
    }
  }

  const handleExtractFromResume = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a resume')
      return
    }

    if (!uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF resume (Gemini parser). DOCX/TXT are not supported yet.')
      return
    }

    setExtracting(true)
    setLinkedinWarning(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadedFile)

      const response = await fetch('/api/skills/extract-resume', {
        method: 'POST',
        body: fd,
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to parse resume')
        return
      }

      setExtractedSkills(data.skills ?? [])
      toast.success(data.message || `Found ${(data.skills ?? []).length} skills`)
    } catch {
      toast.error('Failed to extract skills from resume')
    } finally {
      setExtracting(false)
    }
  }

  const handleSaveExtractedSkills = async () => {
    if (extractedSkills.length === 0) return

    const source = extractedSkills[0]?.source ?? 'ai_extracted'

    try {
      const response = await fetch('/api/skills/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skills: extractedSkills.map((s) => ({
            name: s.name,
            level: s.level,
            confidence: s.confidence,
          })),
          source,
        }),
      })

      const errBody = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error(typeof errBody.error === 'string' ? errBody.error : 'Failed to save skills')
        return
      }

      toast.success('Skills saved to your profile')
      setExtractedSkills([])
      setLinkedinWarning(null)
      setLinkedinUrl('')
      setUploadedFile(null)
      fetchSkills()
    } catch {
      toast.error('Failed to save skills')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Skills Management</h1>
              <p className="text-muted-foreground">
                Add, edit, and manage your professional skills
              </p>
            </div>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Add Skill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Skill</DialogTitle>
                <DialogDescription>
                  Manually add a skill to your profile
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="skill-name">Skill Name</Label>
                  <Input
                    id="skill-name"
                    placeholder="e.g., React, Python, Data Analysis"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proficiency Level</Label>
                  <Select
                    value={newSkill.level}
                    onValueChange={(value) => setNewSkill(prev => ({ ...prev, level: value as DBSkill['level'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Confidence ({newSkill.confidence}%)</Label>
                  <Slider
                    value={[newSkill.confidence]}
                    onValueChange={(value) => setNewSkill(prev => ({ ...prev, confidence: value[0] }))}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddSkill}>Add Skill</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Import Options */}
        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Brain className="size-4" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="flex items-center gap-2">
              <Linkedin className="size-4" />
              LinkedIn Import
            </TabsTrigger>
            <TabsTrigger value="resume" className="flex items-center gap-2">
              <Upload className="size-4" />
              Resume Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-6">
            {/* Current Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  Your Skills ({skills.length})
                </CardTitle>
                <CardDescription>
                  Click on a skill to edit or delete it
                </CardDescription>
              </CardHeader>
              <CardContent>
                {skills.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="size-12 mx-auto mb-4 opacity-30" />
                    <p>No skills added yet</p>
                    <p className="text-sm">Click &quot;Add Skill&quot; to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="group flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{skill.name}</p>
                            <Badge variant="outline" className={`text-[10px] capitalize ${levelColors[skill.level]}`}>
                              {skill.level}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={Number(skill.confidence) * 100} className="h-1 flex-1 max-w-24" />
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(Number(skill.confidence) * 100)}%
                            </span>
                            <Badge variant="secondary" className="text-[9px]">
                              {skill.source}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditingSkill(skill)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => handleDeleteSkill(skill.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="linkedin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Linkedin className="size-5 text-blue-500" />
                  Import from LinkedIn
                </CardTitle>
                <CardDescription>
                  Enter your LinkedIn profile URL to extract skills
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="linkedin.com/in/yourprofile"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button
                    onClick={handleExtractFromLinkedIn}
                    disabled={!linkedinUrl || extracting}
                  >
                    {extracting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      'Extract Skills'
                    )}
                  </Button>
                </div>

                {linkedinWarning && (
                  <p className="text-sm text-amber-600 dark:text-amber-500/90 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    {linkedinWarning}
                  </p>
                )}

                {extractedSkills.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Extracted Skills ({extractedSkills.length})</h3>
                      <Button onClick={handleSaveExtractedSkills}>
                        <CheckCircle2 className="size-4" />
                        Save All
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {extractedSkills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="py-1.5">
                          {skill.name}
                          <span className="ml-1 text-muted-foreground">
                            ({skill.level})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resume" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="size-5 text-emerald-500" />
                  Upload Resume
                </CardTitle>
                <CardDescription>
                  Upload your resume to automatically extract skills
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="sr-only"
                  />
                  {uploadedFile ? (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-5 text-green-500" />
                      <span className="font-medium">{uploadedFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="size-10 text-muted-foreground" />
                      <div className="text-center">
                        <p className="font-medium">Click to upload or drag and drop</p>
                        <p className="text-sm text-muted-foreground">PDF only (parsed with Gemini on the API server)</p>
                      </div>
                    </>
                  )}
                </label>

                {uploadedFile && (
                  <Button
                    onClick={handleExtractFromResume}
                    disabled={extracting}
                    className="w-full"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Analyzing resume...
                      </>
                    ) : (
                      'Extract Skills from Resume'
                    )}
                  </Button>
                )}

                {extractedSkills.length > 0 && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Extracted Skills ({extractedSkills.length})</h3>
                      <Button onClick={handleSaveExtractedSkills}>
                        <CheckCircle2 className="size-4" />
                        Save All
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {extractedSkills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="py-1.5">
                          {skill.name}
                          <span className="ml-1 text-muted-foreground">
                            ({skill.level})
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Skill Dialog */}
        <Dialog open={!!editingSkill} onOpenChange={(open) => !open && setEditingSkill(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Skill</DialogTitle>
              <DialogDescription>
                Update your skill details
              </DialogDescription>
            </DialogHeader>
            {editingSkill && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Skill Name</Label>
                  <Input
                    value={editingSkill.name}
                    onChange={(e) => setEditingSkill(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proficiency Level</Label>
                  <Select
                    value={editingSkill.level}
                    onValueChange={(value) => setEditingSkill(prev => prev ? { ...prev, level: value as DBSkill['level'] } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Confidence ({Math.round(Number(editingSkill.confidence) * 100)}%)</Label>
                  <Slider
                    value={[Number(editingSkill.confidence) * 100]}
                    onValueChange={(value) => setEditingSkill(prev => prev ? { ...prev, confidence: value[0] / 100 } : null)}
                    max={100}
                    step={5}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSkill(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSkill}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
