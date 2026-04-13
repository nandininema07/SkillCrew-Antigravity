'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import {
  Send,
  MessageCircle,
  Plus,
  Copy,
  Trash2,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { fetchConversations, createConversationInDB, saveChatMessage, deleteConversationFromDB, getCurrentUserId } from '@/lib/chat-utils'
import { sendCoachMessageStream } from '@/lib/agents/orchestrator'
import type { ChatMessage as ChatMessageType, ChatConversation } from '@/lib/types'

interface LocalChatMessage extends ChatMessageType {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export default function ChatPage() {
  const { conversations: storeConversations, currentConversation, addChatMessage, setCurrentConversation, setConversations } = useAppStore()
  const [conversations, setLocalConversations] = useState<ChatConversation[]>([])
  const [messages, setMessages] = useState<LocalChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coachPhase, setCoachPhase] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Get authenticated user ID from Supabase on mount
  useEffect(() => {
    const initializeUser = async () => {
      try {
        console.log('Checking authentication status...')
        const authUserId = await getCurrentUserId()
        console.log('Auth check result:', authUserId ? 'User authenticated' : 'No user found')
        
        if (!authUserId) {
          console.warn('User not authenticated, showing login prompt')
          setError('Please log in to access chat features')
          setIsLoadingConversations(false)
          return
        }
        
        setUserId(authUserId)
        console.log('User authenticated with ID:', authUserId)
        setError(null)
      } catch (err) {
        console.error('Failed to initialize user:', err)
        setError('Failed to initialize authentication')
        setIsLoadingConversations(false)
      }
    }

    initializeUser()
  }, [])

  // Load conversations from database when userId is available
  useEffect(() => {
    if (!userId) return

    const loadConversations = async () => {
      try {
        setIsLoadingConversations(true)
        console.log('Loading conversations for user:', userId)
        const fetchedConversations = await fetchConversations(userId)
        console.log('Conversations loaded:', fetchedConversations.length)
        setLocalConversations(fetchedConversations)
        setConversations(fetchedConversations)

        // Auto-select the most recent conversation
        if (fetchedConversations.length > 0) {
          const recent = fetchedConversations[0]
          setCurrentConversation(recent)
          setMessages(recent.messages as LocalChatMessage[])
        } else {
          setError(null)
        }
      } catch (err) {
        console.error('Failed to load conversations:', err)
        setError('Failed to load chat history. Make sure the database tables are created.')
      } finally {
        setIsLoadingConversations(false)
      }
    }

    loadConversations()
  }, [userId, setConversations, setCurrentConversation])

  // Update local messages when current conversation changes
  useEffect(() => {
    if (currentConversation) {
      setMessages(currentConversation.messages as LocalChatMessage[] || [])
      setError(null)
    }
  }, [currentConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleNewChat = async () => {
    if (!userId) {
      setError('Please log in to start a chat')
      return
    }

    try {
      const title = `Chat - ${new Date().toLocaleDateString()}`
      const newConv = await createConversationInDB(userId, title)
      
      if (newConv) {
        const updated = [newConv, ...conversations]
        setLocalConversations(updated)
        setConversations(updated)
        setCurrentConversation(newConv)
        setMessages([])
        setError(null)
      } else {
        setError('Failed to create new chat')
      }
    } catch (err) {
      console.error('Failed to create conversation:', err)
      setError('Failed to create new chat')
    }
  }

  const handleSelectConversation = async (conversation: ChatConversation) => {
    try {
      // Reload the conversation from the database to get fresh messages
      const freshConversations = await fetchConversations(userId || '')
      const freshConversation = freshConversations.find(c => c.id === conversation.id)
      
      if (freshConversation) {
        setCurrentConversation(freshConversation)
        setMessages(freshConversation.messages as LocalChatMessage[])
        // Update the conversations list with the fresh data
        setLocalConversations(freshConversations)
        setConversations(freshConversations)
        console.log('Loaded fresh conversation:', freshConversation.id, 'with', freshConversation.messages.length, 'messages')
      } else {
        setCurrentConversation(conversation)
        setMessages(conversation.messages as LocalChatMessage[])
      }
      setError(null)
    } catch (err) {
      console.error('Failed to reload conversation:', err)
      // Fallback to the cached version
      setCurrentConversation(conversation)
      setMessages(conversation.messages as LocalChatMessage[])
      setError(null)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !currentConversation?.id) {
      setError('Please select a conversation first')
      return
    }

    const userMessage: LocalChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: currentConversation.id,
      role: 'user',
      content: input,
      createdAt: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)
    setCoachPhase(null)

    try {
      // Save user message to database
      await saveChatMessage(currentConversation.id, 'user', input)
      addChatMessage(currentConversation.id, userMessage)

      const afterUser: ChatConversation = {
        ...currentConversation,
        messages: [...(currentConversation.messages || []), userMessage],
      }
      setCurrentConversation(afterUser)

      let assistantText: string
      try {
        const coach = await sendCoachMessageStream(input, currentConversation.id, (ev) => {
          if (ev.type === 'phase' && typeof ev.phase === 'string') {
            setCoachPhase(ev.phase)
          }
        })
        assistantText =
          typeof coach.assistant_message === 'string' && coach.assistant_message.trim()
            ? coach.assistant_message.trim()
            : 'I’m here with you. Tell me a bit more about what feels hardest right now, and we’ll adjust your plan together.'
        if (coach.actions?.refresh_roadmap) {
          assistantText +=
            '\n\n— When you are ready, open the dashboard and use “Save & build roadmap” so Archie can regenerate your path with the new pacing.'
        }
      } catch (err) {
        console.error(err)
        setCoachPhase(null)
        assistantText =
          'I could not reach the coach service right now. Check that the backend is running, `BACKEND_AGENT_SECRET` matches on Next and FastAPI, and your Groq or Google key is set. Your message was still saved.'
      }

      const assistantMessage: LocalChatMessage = {
        id: `msg-${Date.now() + 1}`,
        conversationId: currentConversation.id,
        role: 'assistant',
        content: assistantText,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      await saveChatMessage(currentConversation.id, 'assistant', assistantText)
      addChatMessage(currentConversation.id, assistantMessage)

      const updatedConv: ChatConversation = {
        ...afterUser,
        messages: [...(afterUser.messages || []), assistantMessage],
      }
      setCurrentConversation(updatedConv)

      setIsLoading(false)
      setCoachPhase(null)
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to send message')
      setIsLoading(false)
      setCoachPhase(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteConversationFromDB(id)
      const updated = conversations.filter((c) => c.id !== id)
      setLocalConversations(updated)
      setConversations(updated)

      if (currentConversation?.id === id) {
        if (updated.length > 0) {
          setCurrentConversation(updated[0])
        } else {
          setCurrentConversation(null)
          setMessages([])
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
      setError('Failed to delete conversation')
    }
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  if (isLoadingConversations && !userId) {
    return (
      <div className="min-h-screen bg-background p-6 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
              <p className="text-sm text-muted-foreground text-center">Initializing chat...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8 flex gap-6">
      {/* Chat History Sidebar */}
      <div className="hidden lg:flex w-80 flex-col gap-4">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="size-5" />
                Chat History
              </CardTitle>
              <Button
                onClick={handleNewChat}
                size="sm"
                className="gap-2"
                disabled={isLoadingConversations || !userId}
              >
                <Plus className="size-4" />
                New
              </Button>
            </div>
            <CardDescription>Your saved conversations</CardDescription>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-0">
            {isLoadingConversations ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <div className="animate-pulse space-y-2">
                  <div className="h-12 bg-muted rounded" />
                  <div className="h-12 bg-muted rounded" />
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <p>No conversations yet</p>
                <p className="text-xs mt-2">Click "New" to start chatting</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={cn(
                      'w-full p-3 rounded-lg border transition-all text-left hover:border-primary/50 group',
                      currentConversation?.id === conversation.id
                        ? 'bg-primary/10 border-primary/30'
                        : 'border-border/50 hover:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">
                          {conversation.title}
                        </h4>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatDate(conversation.updatedAt)}
                        </div>
                        {conversation.summary && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {conversation.summary}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conversation.id, e)}
                        className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chat Area */}
      <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col gap-6">
        {/* Chat Messages */}
        <Card className="flex-1 flex flex-col min-h-[600px]">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <MessageCircle className="size-6" />
              <div>
                <CardTitle className="text-lg">Learning Assistant</CardTitle>
                <CardDescription>Ask about your courses and learning plans</CardDescription>
              </div>
            </div>
          </CardHeader>

          {error && (
            <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                  <MessageCircle className="size-12 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    {conversations.length === 0 ? 'Start a new chat' : 'No messages in this conversation'}
                  </p>
                  <p className="text-xs text-muted-foreground">Ask questions to get started</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 animate-in fade-in slide-in-from-bottom-2',
                    message.role === 'user' && 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-lg px-4 py-2 max-w-[80%] break-words',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-muted-foreground rounded-bl-none'
                    )}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className={cn(
                      'text-xs mt-1 opacity-70',
                      message.role === 'user' && 'text-primary-foreground/70'
                    )}>
                      {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {message.role === 'assistant' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 mt-auto"
                      onClick={() => {
                        navigator.clipboard.writeText(message.content)
                      }}
                    >
                      <Copy className="size-3" />
                    </Button>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex flex-col gap-1">
                <div className="flex gap-3">
                  <div className="rounded-lg rounded-bl-none bg-muted px-4 py-3">
                    <div className="flex gap-2">
                      <div className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
                      <div className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
                      <div className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
                {coachPhase ? (
                  <p className="pl-1 text-xs text-muted-foreground capitalize">
                    {coachPhase.replace(/_/g, ' ')}…
                  </p>
                ) : null}
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input Area */}
          <div className="border-t p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={currentConversation ? "Ask about your courses..." : "Create a new chat first..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !currentConversation}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading || !currentConversation}
                size="icon"
              >
                <Send className="size-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Powered by SkillCrew Learning Assistant
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
