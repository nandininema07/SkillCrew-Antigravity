'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
  Settings,
  User,
  Bell,
  Lock,
  Eye,
  Download,
  Trash2,
  ArrowLeft,
  Check,
  Copy,
  BookOpen,
  Code,
  Zap,
  Loader2,
  Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DBProfile, DBSkill, DBUserPreferences } from '@/lib/database.types'

const SPARKY_TIMEZONES = [
  'UTC',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
] as const

function normalizeDigestTime(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string' || !raw.includes(':')) return '18:00'
  const [a, b] = raw.split(':')
  const h = Math.min(23, Math.max(0, parseInt(a, 10) || 18))
  const m = Math.min(59, Math.max(0, parseInt(b || '0', 10)))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<DBProfile | null>(null)
  const [skills, setSkills] = useState<DBSkill[]>([])
  const [preferences, setPreferences] = useState<DBUserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [linkedinDialogOpen, setLinkedinDialogOpen] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    linkedin_url: '',
    portfolio_url: '',
  })
  const [preferencesForm, setPreferencesForm] = useState({
    difficulty_level: 'intermediate',
    learning_pace: 'balanced',
    preferred_content: 'mixed',
    daily_goal_minutes: 30,
    email_notifications: true,
    push_notifications: true,
    daily_reminders: true,
    streak_alerts: true,
  })
  const [digestForm, setDigestForm] = useState({
    notify_whatsapp_digest: true,
    notify_voice_daily_learning: false,
    sparky_digest_local_time: '18:00',
    sparky_digest_timezone:
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  })

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, skillsRes, prefsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/skills'),
        fetch('/api/preferences'),
      ])

      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data)
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          linkedin_url: data.linkedin_url || '',
          portfolio_url: data.portfolio_url || '',
        })
        const tzRaw =
          (data.sparky_digest_timezone && String(data.sparky_digest_timezone).trim()) ||
          (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
        setDigestForm({
          notify_whatsapp_digest: data.notify_whatsapp_digest !== false,
          notify_voice_daily_learning: data.notify_voice_daily_learning === true,
          sparky_digest_local_time: normalizeDigestTime(data.sparky_digest_local_time),
          sparky_digest_timezone: SPARKY_TIMEZONES.includes(tzRaw as (typeof SPARKY_TIMEZONES)[number])
            ? tzRaw
            : 'UTC',
        })
      }
      if (skillsRes.ok) {
        setSkills(await skillsRes.json())
      }
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json()
        setPreferences(prefsData)
        setPreferencesForm({
          difficulty_level: prefsData.difficulty_level,
          learning_pace: prefsData.learning_pace,
          preferred_content: prefsData.preferred_content,
          daily_goal_minutes: prefsData.daily_goal_minutes,
          email_notifications: prefsData.email_notifications,
          push_notifications: prefsData.push_notifications,
          daily_reminders: prefsData.daily_reminders,
          streak_alerts: prefsData.streak_alerts,
        })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        toast.success('Profile updated successfully')
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDigestSchedule = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          notify_whatsapp_digest: digestForm.notify_whatsapp_digest,
          notify_voice_daily_learning: digestForm.notify_voice_daily_learning,
          sparky_digest_local_time: digestForm.sparky_digest_local_time,
          sparky_digest_timezone: digestForm.sparky_digest_timezone,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        toast.success('Digest schedule saved')
      } else {
        toast.error('Failed to save digest settings')
      }
    } catch {
      toast.error('Failed to save digest settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferencesForm),
      })

      if (response.ok) {
        toast.success('Preferences updated successfully')
      } else {
        toast.error('Failed to update preferences')
      }
    } catch {
      toast.error('Failed to update preferences')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out successfully')
    router.push('/')
    router.refresh()
  }

  const handleImportFromLinkedIn = async () => {
    if (!linkedinUrl.trim()) {
      toast.error('Please enter a LinkedIn URL')
      return
    }

    setIsImporting(true)
    try {
      const response = await fetch('/api/scrape-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: linkedinUrl.trim() }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Skills imported successfully from LinkedIn')
        setLinkedinDialogOpen(false)
        setLinkedinUrl('')
        // Refresh skills
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to import skills')
      }
    } catch (error) {
      console.error('Error importing from LinkedIn:', error)
      toast.error('Failed to import skills')
    } finally {
      setIsImporting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
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
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Please Log In</CardTitle>
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

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/dashboard" className="gap-1">
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="size-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <User className="size-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Lightbulb className="size-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <Lock className="size-4" />
              Account
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-6">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="size-24 border-2 border-primary">
                      <AvatarImage src={profile.avatar_url || undefined} alt={userName} />
                      <AvatarFallback className="bg-primary/10 text-lg font-bold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                    <Input
                      id="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                      placeholder="linkedin.com/in/yourprofile"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portfolio_url">Portfolio URL</Label>
                    <Input
                      id="portfolio_url"
                      value={formData.portfolio_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, portfolio_url: e.target.value }))}
                      placeholder="yourportfolio.com"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save Changes
                        <Check className="size-4" />
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setFormData({
                    full_name: profile.full_name || '',
                    phone: profile.phone || '',
                    linkedin_url: profile.linkedin_url || '',
                    portfolio_url: profile.portfolio_url || '',
                  })}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Your Skills</CardTitle>
                    <CardDescription>Current skills and proficiency levels</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={linkedinDialogOpen} onOpenChange={setLinkedinDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Import from LinkedIn
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Import Skills from LinkedIn</DialogTitle>
                          <DialogDescription>
                            Enter your LinkedIn profile URL to automatically import your skills.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="linkedin-url">LinkedIn URL</Label>
                            <Input
                              id="linkedin-url"
                              placeholder="https://www.linkedin.com/in/yourprofile"
                              value={linkedinUrl}
                              onChange={(e) => setLinkedinUrl(e.target.value)}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => setLinkedinDialogOpen(false)}
                              disabled={isImporting}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleImportFromLinkedIn} disabled={isImporting}>
                              {isImporting ? 'Importing...' : 'Import Skills'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/skills">Manage Skills</Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {skills.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-4">No skills added yet</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/dashboard/skills">Add Skills</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.slice(0, 10).map((skill) => (
                      <Badge key={skill.id} variant="secondary" className="py-1.5">
                        {skill.name}
                        <span className="ml-1 text-muted-foreground capitalize">
                          ({skill.level})
                        </span>
                      </Badge>
                    ))}
                    {skills.length > 10 && (
                      <Badge variant="outline" className="py-1.5">
                        +{skills.length - 10} more
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Learning Preferences</CardTitle>
                <CardDescription>Customize your learning experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Difficulty Level</h4>
                      <p className="text-sm text-muted-foreground">Choose your preferred difficulty</p>
                    </div>
                    <select 
                      value={preferencesForm.difficulty_level}
                      onChange={(e) => setPreferencesForm(prev => ({ ...prev, difficulty_level: e.target.value }))}
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Learning Pace</h4>
                      <p className="text-sm text-muted-foreground">How fast you want to progress</p>
                    </div>
                    <select 
                      value={preferencesForm.learning_pace}
                      onChange={(e) => setPreferencesForm(prev => ({ ...prev, learning_pace: e.target.value }))}
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="slow">Slow</option>
                      <option value="balanced">Balanced</option>
                      <option value="fast">Fast</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Preferred Content Type</h4>
                      <p className="text-sm text-muted-foreground">What you like to learn from</p>
                    </div>
                    <select 
                      value={preferencesForm.preferred_content}
                      onChange={(e) => setPreferencesForm(prev => ({ ...prev, preferred_content: e.target.value }))}
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="video">Videos</option>
                      <option value="text">Text/Articles</option>
                      <option value="interactive">Interactive</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Daily Goal</h4>
                      <p className="text-sm text-muted-foreground">Target learning time per day</p>
                    </div>
                    <select 
                      value={String(preferencesForm.daily_goal_minutes)}
                      onChange={(e) => setPreferencesForm(prev => ({ ...prev, daily_goal_minutes: Number(e.target.value) }))}
                      className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2+ hours</option>
                    </select>
                  </div>
                </div>

                <Button className="w-full" onClick={handleSavePreferences} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Control how and when we notify you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Email Notifications</h4>
                      <p className="text-sm text-muted-foreground">Receive updates via email</p>
                    </div>
                    <Switch 
                      checked={preferencesForm.email_notifications}
                      onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, email_notifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Push Notifications</h4>
                      <p className="text-sm text-muted-foreground">Browser notifications</p>
                    </div>
                    <Switch 
                      checked={preferencesForm.push_notifications}
                      onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, push_notifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Daily Reminders</h4>
                      <p className="text-sm text-muted-foreground">Daily learning reminders</p>
                    </div>
                    <Switch 
                      checked={preferencesForm.daily_reminders}
                      onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, daily_reminders: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <h4 className="font-medium">Streak Alerts</h4>
                      <p className="text-sm text-muted-foreground">Alerts when your streak is at risk</p>
                    </div>
                    <Switch 
                      checked={preferencesForm.streak_alerts}
                      onCheckedChange={(checked) => setPreferencesForm(prev => ({ ...prev, streak_alerts: checked }))}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={handleSavePreferences} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Notification Settings'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5 text-amber-500" />
                  Daily learning summary (Sparky)
                </CardTitle>
                <CardDescription>
                  After your chosen local time, when you open the dashboard we can send a WhatsApp recap and
                  optionally a short voice call — using your Twilio-linked phone number. No separate cron job is
                  required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">WhatsApp summary</h4>
                    <p className="text-sm text-muted-foreground">Recap of what you learned recently</p>
                  </div>
                  <Switch
                    checked={digestForm.notify_whatsapp_digest}
                    onCheckedChange={(checked) =>
                      setDigestForm((prev) => ({ ...prev, notify_whatsapp_digest: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <h4 className="font-medium">Voice summary</h4>
                    <p className="text-sm text-muted-foreground">Optional call with the same recap (Twilio voice)</p>
                  </div>
                  <Switch
                    checked={digestForm.notify_voice_daily_learning}
                    onCheckedChange={(checked) =>
                      setDigestForm((prev) => ({ ...prev, notify_voice_daily_learning: checked }))
                    }
                  />
                </div>

                <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="digest-time">Earliest send time (your day)</Label>
                    <Input
                      id="digest-time"
                      type="time"
                      value={digestForm.sparky_digest_local_time}
                      onChange={(e) =>
                        setDigestForm((prev) => ({ ...prev, sparky_digest_local_time: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      We send only after this time, when you visit the app, at most once per local day.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={digestForm.sparky_digest_timezone}
                      onValueChange={(v) => setDigestForm((prev) => ({ ...prev, sparky_digest_timezone: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {SPARKY_TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full" type="button" onClick={handleSaveDigestSchedule} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save digest schedule'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Account ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono text-sm truncate">{profile.id}</code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(profile.id)}>
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Account Created</p>
                  <p className="font-medium">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data & Privacy</CardTitle>
                <CardDescription>Manage your data and privacy settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Download className="size-4" />
                  Download My Data
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Eye className="size-4" />
                  Privacy Policy
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSignOut}>
                  <Lock className="size-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/30 dark:border-red-900/30 dark:bg-red-950/10">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30">
                  <Trash2 className="size-4" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Help & Support */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="#" className="flex gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <BookOpen className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Documentation</h4>
                  <p className="text-xs text-muted-foreground">Read our guides</p>
                </div>
              </Link>
              <Link href="#" className="flex gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <Zap className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Support Center</h4>
                  <p className="text-xs text-muted-foreground">Contact us</p>
                </div>
              </Link>
              <Link href="#" className="flex gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                <Code className="size-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">API Docs</h4>
                  <p className="text-xs text-muted-foreground">Integrate with us</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
