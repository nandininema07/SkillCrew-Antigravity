'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgentId, UserProfile, LearningPath, Skill, Badge, FlashCard, AgentMessage, ChatConversation, ChatMessage } from './types'

interface AppState {
  // Navigation
  currentPage: 'landing' | 'onboarding' | 'dashboard' | 'revision' | 'progress'
  setCurrentPage: (page: AppState['currentPage']) => void
  
  // User
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void
  updateUserXP: (xp: number) => void
  addBadge: (badge: Badge) => void
  
  // Onboarding
  onboardingStep: number
  setOnboardingStep: (step: number) => void
  extractedSkills: Skill[]
  setExtractedSkills: (skills: Skill[]) => void
  selectedGoal: 'skill-mastery' | 'job-readiness' | 'certification' | null
  setSelectedGoal: (goal: AppState['selectedGoal']) => void
  
  // Learning Path
  currentPath: LearningPath | null
  setCurrentPath: (path: LearningPath | null) => void
  updateModuleProgress: (moduleId: string, progress: number) => void
  
  // Agents
  activeAgent: AgentId | null
  setActiveAgent: (agent: AgentId | null) => void
  agentMessages: AgentMessage[]
  addAgentMessage: (message: AgentMessage) => void
  clearAgentMessages: () => void
  
  // Chat Conversations
  conversations: ChatConversation[]
  setConversations: (conversations: ChatConversation[]) => void
  currentConversation: ChatConversation | null
  setCurrentConversation: (conversation: ChatConversation | null) => void
  createConversation: (title: string) => ChatConversation
  addChatMessage: (conversationId: string, message: ChatMessage) => void
  deleteConversation: (conversationId: string) => void
  
  // Revision
  flashcards: FlashCard[]
  setFlashcards: (cards: FlashCard[]) => void
  addFlashcard: (card: FlashCard) => void
  updateFlashcardMastery: (cardId: string, mastery: number) => void
  mindmaps: MindMap[]
  setMindmaps: (maps: MindMap[]) => void
  addMindmap: (map: MindMap) => void
  revisionPacks: RevisionPack[]
  setRevisionPacks: (packs: RevisionPack[]) => void
  addRevisionPack: (pack: RevisionPack) => void
  
  // UI State
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Navigation
      currentPage: 'landing',
      setCurrentPage: (page) => set({ currentPage: page }),
      
      // User
      user: null,
      setUser: (user) => set({ user }),
      updateUserXP: (xp) => set((state) => ({
        user: state.user ? { ...state.user, xp: state.user.xp + xp } : null
      })),
      addBadge: (badge) => set((state) => ({
        user: state.user ? { ...state.user, badges: [...state.user.badges, badge] } : null
      })),
      
      // Onboarding
      onboardingStep: 0,
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      extractedSkills: [],
      setExtractedSkills: (skills) => set({ extractedSkills: skills }),
      selectedGoal: null,
      setSelectedGoal: (goal) => set({ selectedGoal: goal }),
      
      // Learning Path
      currentPath: null,
      setCurrentPath: (path) => set({ currentPath: path }),
      updateModuleProgress: (moduleId, progress) => set((state) => {
        if (!state.currentPath) return state
        const modules = state.currentPath.modules.map(m => 
          m.id === moduleId ? { ...m, progress } : m
        )
        const totalProgress = modules.reduce((sum, m) => sum + m.progress, 0) / modules.length
        return {
          currentPath: { ...state.currentPath, modules, progress: totalProgress }
        }
      }),
      
      // Agents
      activeAgent: null,
      setActiveAgent: (agent) => set({ activeAgent: agent }),
      agentMessages: [],
      addAgentMessage: (message) => set((state) => ({
        agentMessages: [...state.agentMessages, message]
      })),
      clearAgentMessages: () => set({ agentMessages: [] }),
      
      // Chat Conversations
      conversations: [],
      setConversations: (conversations) => set({ conversations }),
      currentConversation: null,
      setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
      createConversation: (title) => {
        const newConversation: ChatConversation = {
          id: `conv-${Date.now()}`,
          userId: '',
          title,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversation: newConversation,
        }))
        return newConversation
      },
      addChatMessage: (conversationId, message) => set((state) => {
        const conversations = state.conversations.map((conv) => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              messages: [...conv.messages, message],
              updatedAt: new Date(),
            }
          }
          return conv
        })
        const currentConversation = state.currentConversation?.id === conversationId
          ? conversations.find((c) => c.id === conversationId) || state.currentConversation
          : state.currentConversation
        return {
          conversations,
          currentConversation,
        }
      }),
      deleteConversation: (conversationId) => set((state) => {
        const conversations = state.conversations.filter((c) => c.id !== conversationId)
        const currentConversation =
          state.currentConversation?.id === conversationId
            ? conversations[0] || null
            : state.currentConversation
        return {
          conversations,
          currentConversation,
        }
      }),
      
      // Revision
      flashcards: [],
      setFlashcards: (cards) => set({ flashcards: cards }),
      addFlashcard: (card) => set((state) => ({
        flashcards: [...state.flashcards, card]
      })),
      updateFlashcardMastery: (cardId, mastery) => set((state) => ({
        flashcards: state.flashcards.map(c => 
          c.id === cardId ? { ...c, mastery } : c
        )
      })),
      mindmaps: [],
      setMindmaps: (maps) => set({ mindmaps: maps }),
      addMindmap: (map) => set((state) => ({
        mindmaps: [...state.mindmaps, map]
      })),
      revisionPacks: [],
      setRevisionPacks: (packs) => set({ revisionPacks: packs }),
      addRevisionPack: (pack) => set((state) => ({
        revisionPacks: [...state.revisionPacks, pack]
      })),
      
      // UI State
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),
    }),
    {
      name: 'skillcrew-storage',
      partialize: (state) => ({
        user: state.user,
        currentPath: state.currentPath,
        flashcards: state.flashcards,
        mindmaps: state.mindmaps,
        revisionPacks: state.revisionPacks,
        extractedSkills: state.extractedSkills,
        selectedGoal: state.selectedGoal,
      }),
    }
  )
)
