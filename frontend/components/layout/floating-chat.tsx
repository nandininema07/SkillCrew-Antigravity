'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AgentAvatar } from '@/components/agents/agent-avatar'
import { agents, agentOrder } from '@/lib/agents'
import { useAppStore } from '@/lib/store'
import { MessageCircle, X, Send, Mic, ChevronDown } from 'lucide-react'
import type { AgentId } from '@/lib/types'

interface Message {
  id: string
  agentId: AgentId
  content: string
  timestamp: Date
  isUser?: boolean
}

export function FloatingChat() {
  const { chatOpen, setChatOpen, activeAgent, setActiveAgent } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      agentId: 'nova',
      content: "Hello! I'm Nova, your intake specialist. I'm here to help you get started on your learning journey. How can I assist you today?",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('nova')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      agentId: selectedAgent,
      content: input,
      timestamp: new Date(),
      isUser: true,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Simulate agent response
    setTimeout(() => {
      const responses: Record<AgentId, string[]> = {
        nova: [
          "I understand you want to improve your skills. Let me analyze your profile to create a personalized path.",
          "Great question! Based on your current skills, I recommend focusing on the fundamentals first.",
          "I can help you identify skill gaps. Would you like to upload your resume for analysis?",
        ],
        archie: [
          "I've designed an optimal learning sequence for you based on your goals.",
          "Your current path is well-structured. Would you like me to adjust the difficulty?",
          "I recommend tackling these modules in order for maximum retention.",
        ],
        dexter: [
          "I found some excellent resources that match your current level.",
          "Here's a curated list of videos and articles for this topic.",
          "I've set up an interactive sandbox for hands-on practice.",
        ],
        pip: [
          "Time for some spaced repetition! Let's review what you learned yesterday.",
          "I've created flashcards from your recent modules. Ready to practice?",
          "Your concept map is growing nicely. Let me show you the connections.",
        ],
        sparky: [
          "You're on a 7-day streak! Keep up the amazing work!",
          "You just unlocked a new badge! Check your inventory.",
          "You're climbing the leaderboard! Just 50 XP to the next level.",
        ],
      }

      const agentResponses = responses[selectedAgent]
      const randomResponse = agentResponses[Math.floor(Math.random() * agentResponses.length)]

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        agentId: selectedAgent,
        content: randomResponse,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, agentMessage])
    }, 1000)
  }

  if (!chatOpen) {
    return (
      <Button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg hover:shadow-xl transition-all"
      >
        <MessageCircle className="size-6" />
      </Button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-96 h-[500px] rounded-2xl border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card/80 backdrop-blur px-4 py-3">
        <div className="flex items-center gap-3">
          <AgentAvatar agentId={selectedAgent} size="sm" active />
          <div>
            <p className="font-semibold text-sm">{agents[selectedAgent].name}</p>
            <p className="text-xs text-muted-foreground">{agents[selectedAgent].role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8">
            <Mic className="size-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-8"
            onClick={() => setChatOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Agent Selector */}
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
        {agentOrder.map((id) => (
          <button
            key={id}
            onClick={() => setSelectedAgent(id)}
            className={cn(
              'rounded-full p-1 transition-all',
              selectedAgent === id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
            )}
          >
            <AgentAvatar agentId={id} size="sm" active={selectedAgent === id} showGlow={false} />
          </button>
        ))}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-2',
                message.isUser && 'flex-row-reverse'
              )}
            >
              {!message.isUser && (
                <AgentAvatar agentId={message.agentId} size="sm" showGlow={false} />
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                  message.isUser
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${agents[selectedAgent].name}...`}
            className="flex-1 bg-muted border-0"
          />
          <Button type="submit" size="icon" className="shrink-0">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
