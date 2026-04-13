'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AgentCard, AgentAvatar } from '@/components/agents'
import { agents, agentOrder } from '@/lib/agents'
import {
  Sparkles,
  ArrowRight,
  Play,
  Linkedin,
  FileText,
  CheckCircle2,
  Zap,
  Brain,
  Target,
  TrendingUp,
  Users,
  Shield,
  ChevronRight,
} from 'lucide-react'

export default function LandingPage() {
  const [activeDemo, setActiveDemo] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const interval = setInterval(() => {
      setActiveDemo((prev) => (prev + 1) % 3)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">SkillCrew</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#agents" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Meet the Crew
            </a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/sign-up">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-chart-2/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className={cn(
            "text-center space-y-6 transition-all duration-1000",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          )}>
            <Badge variant="secondary" className="px-4 py-1.5 text-sm">
              <Sparkles className="size-3 mr-1" />
              Powered by 5 Autonomous AI Agents
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance">
              Your Learning Crew:
              <br />
              <span className="bg-gradient-to-r from-primary via-chart-2 to-chart-3 bg-clip-text text-transparent">
                Autonomous Agents
              </span>
              <br />
              for Skill Mastery
            </h1>

            <p className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground text-pretty">
              Five specialized AI agents work together to create your personalized learning path, 
              curate resources, reinforce memory, and keep you motivated.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button size="lg" className="w-full sm:w-auto group" asChild>
                <Link href="/auth/sign-up">
                  <Linkedin className="size-5" />
                  Get Started Free
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/auth/login">
                  <FileText className="size-5" />
                  Sign In
                </Link>
              </Button>
            </div>

            {/* Agent Preview */}
            <div className="flex items-center justify-center gap-2 pt-8">
              {agentOrder.map((id, index) => (
                <div
                  key={id}
                  className={cn(
                    "transition-all duration-500",
                    isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75"
                  )}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <AgentAvatar agentId={id} size="lg" showGlow />
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Meet Nova, Archie, Dexter, Pip & Sparky
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Learn Smarter
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our AI-powered platform adapts to your unique learning style and goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: 'Personalized Paths',
                description: 'Custom learning journeys based on your skills, goals, and learning style.',
              },
              {
                icon: Brain,
                title: 'Spaced Repetition',
                description: 'Intelligent review scheduling to maximize long-term retention.',
              },
              {
                icon: Zap,
                title: 'Adaptive Learning',
                description: 'Content difficulty adjusts in real-time based on your performance.',
              },
              {
                icon: TrendingUp,
                title: 'Progress Analytics',
                description: 'Detailed insights into your learning patterns and improvement areas.',
              },
              {
                icon: Users,
                title: 'Community Leaderboards',
                description: 'Stay motivated with friendly competition and achievement badges.',
              },
              {
                icon: Shield,
                title: 'Curated Resources',
                description: 'Quality-vetted content from across the web, matched to your level.',
              },
            ].map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Showcase */}
      <section id="agents" className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Meet Your Crew</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Five Agents, One Mission
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Each agent specializes in a different aspect of your learning journey, 
              working together seamlessly to help you achieve mastery.
            </p>
          </div>

          {/* Agent Coordination Visualization */}
          <div className="relative mb-12 p-8 rounded-2xl border bg-card/50">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-chart-2/5 rounded-2xl" />
            <div className="relative flex flex-col lg:flex-row items-center justify-center gap-4">
              {agentOrder.map((id, index) => {
                const agent = agents[id]
                return (
                  <div key={id} className="flex items-center">
                    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background/80 border">
                      <AgentAvatar agentId={id} size="lg" active showGlow />
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground text-center max-w-[120px]">
                        {agent.role}
                      </p>
                    </div>
                    {index < agentOrder.length - 1 && (
                      <ChevronRight className="size-5 text-muted-foreground mx-2 hidden lg:block" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Coordination Flow:</span>{' '}
                Nova extracts skills → Archie designs path → Dexter finds resources → Pip reinforces learning → Sparky celebrates progress
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agentOrder.map((id) => (
              <AgentCard key={id} agent={agents[id]} variant="showcase" />
            ))}
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 px-6 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Watch Your Path Adapt in Real-Time
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your learning path dynamically adjusts based on your performance, 
              ensuring you always learn at the optimal pace.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Demo Visualization */}
            <div className="relative aspect-[4/3] rounded-2xl border bg-card overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="absolute inset-4 flex flex-col justify-center">
                <div className="space-y-3">
                  {['JavaScript Basics', 'React Fundamentals', 'State Management', 'API Integration'].map((module, index) => (
                    <div
                      key={module}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-500",
                        index <= activeDemo
                          ? "bg-primary/10 border-primary/50"
                          : "bg-muted/50 border-muted"
                      )}
                    >
                      <div className={cn(
                        "size-8 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                        index < activeDemo
                          ? "bg-green-500 text-white"
                          : index === activeDemo
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {index < activeDemo ? <CheckCircle2 className="size-4" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "font-medium text-sm",
                          index > activeDemo && "text-muted-foreground"
                        )}>
                          {module}
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{
                              width: index < activeDemo ? '100%' : index === activeDemo ? '60%' : '0%'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-6">
              {[
                {
                  step: '01',
                  title: 'Share Your Profile',
                  description: 'Connect LinkedIn or upload your resume. Nova extracts and validates your skills.',
                  agent: 'nova' as const,
                },
                {
                  step: '02',
                  title: 'Get Your Custom Path',
                  description: 'Archie designs a personalized learning journey based on your goals.',
                  agent: 'archie' as const,
                },
                {
                  step: '03',
                  title: 'Learn & Practice',
                  description: 'Dexter curates the best resources while Pip reinforces your memory.',
                  agent: 'dexter' as const,
                },
                {
                  step: '04',
                  title: 'Track Progress',
                  description: 'Sparky celebrates your wins and keeps you motivated with gamification.',
                  agent: 'sparky' as const,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <AgentAvatar agentId={item.agent} size="md" showGlow={false} />
                  <div>
                    <p className="text-xs text-primary font-medium">Step {item.step}</p>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Learn Smarter?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of learners who are mastering new skills with the help of their AI crew.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link href="/auth/sign-up">
                  Start Your Journey
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                <Link href="/auth/login">
                  Sign In
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">SkillCrew</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Made with AI agents that actually care about your learning.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
