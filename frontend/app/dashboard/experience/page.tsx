'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  Building2,
  Calendar,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBWorkExperience } from '@/lib/database.types'

export default function ExperienceManagementPage() {
  const [experiences, setExperiences] = useState<DBWorkExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingExperience, setEditingExperience] = useState<DBWorkExperience | null>(null)
  const [formData, setFormData] = useState({
    company: '',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_current: false,
  })

  const fetchExperiences = useCallback(async () => {
    try {
      const response = await fetch('/api/work-experience')
      if (response.ok) {
        const data = await response.json()
        setExperiences(data)
      }
    } catch (error) {
      console.error('Error fetching experiences:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExperiences()
  }, [fetchExperiences])

  const resetForm = () => {
    setFormData({
      company: '',
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      is_current: false,
    })
  }

  const handleAdd = async () => {
    if (!formData.company || !formData.title) {
      toast.error('Company and title are required')
      return
    }

    try {
      const response = await fetch('/api/work-experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Experience added successfully')
        resetForm()
        setShowAddDialog(false)
        fetchExperiences()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add experience')
      }
    } catch {
      toast.error('Failed to add experience')
    }
  }

  const handleUpdate = async () => {
    if (!editingExperience) return

    try {
      const response = await fetch(`/api/work-experience/${editingExperience.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Experience updated successfully')
        resetForm()
        setEditingExperience(null)
        fetchExperiences()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update experience')
      }
    } catch {
      toast.error('Failed to update experience')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/work-experience/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Experience deleted')
        fetchExperiences()
      }
    } catch {
      toast.error('Failed to delete experience')
    }
  }

  const openEditDialog = (experience: DBWorkExperience) => {
    setEditingExperience(experience)
    setFormData({
      company: experience.company,
      title: experience.title,
      description: experience.description || '',
      start_date: experience.start_date || '',
      end_date: experience.end_date || '',
      is_current: experience.is_current,
    })
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const ExperienceForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            placeholder="Company name"
            value={formData.company}
            onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Job Title</Label>
          <Input
            id="title"
            placeholder="Your role"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your responsibilities and achievements..."
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start Date</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End Date</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            disabled={formData.is_current}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="is_current"
          checked={formData.is_current}
          onCheckedChange={(checked) => setFormData(prev => ({ 
            ...prev, 
            is_current: checked as boolean,
            end_date: checked ? '' : prev.end_date,
          }))}
        />
        <Label htmlFor="is_current" className="text-sm font-normal cursor-pointer">
          I currently work here
        </Label>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Work Experience</h1>
              <p className="text-muted-foreground">
                Manage your professional work history
              </p>
            </div>
          </div>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open)
            if (!open) resetForm()
          }}>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="size-4" />
              Add Experience
            </Button>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Work Experience</DialogTitle>
                <DialogDescription>
                  Add your professional experience to your profile
                </DialogDescription>
              </DialogHeader>
              <ExperienceForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowAddDialog(false)
                  resetForm()
                }}>
                  Cancel
                </Button>
                <Button onClick={handleAdd}>Add Experience</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Experiences List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="size-5" />
              Your Experience ({experiences.length})
            </CardTitle>
            <CardDescription>
              Your professional work history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {experiences.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="size-12 mx-auto mb-4 opacity-30" />
                <p>No work experience added yet</p>
                <p className="text-sm">Click &quot;Add Experience&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {experiences.map((experience) => (
                  <div
                    key={experience.id}
                    className="group p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{experience.title}</h3>
                          {experience.is_current && (
                            <Badge variant="secondary" className="text-[10px]">Current</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Building2 className="size-4" />
                          <span>{experience.company}</span>
                          <span className="mx-1">•</span>
                          <Calendar className="size-4" />
                          <span>
                            {formatDate(experience.start_date)} - {experience.is_current ? 'Present' : formatDate(experience.end_date)}
                          </span>
                        </div>
                        {experience.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {experience.description}
                          </p>
                        )}
                        <Badge variant="outline" className="mt-2 text-[9px]">
                          {experience.source}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditDialog(experience)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => handleDelete(experience.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingExperience} onOpenChange={(open) => {
          if (!open) {
            setEditingExperience(null)
            resetForm()
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Work Experience</DialogTitle>
              <DialogDescription>
                Update your work experience details
              </DialogDescription>
            </DialogHeader>
            <ExperienceForm isEdit />
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditingExperience(null)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
