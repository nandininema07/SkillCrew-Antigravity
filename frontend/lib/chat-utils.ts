import { createClient } from '@/lib/supabase/client'
import type { ChatConversation, ChatMessage as ChatMessageType } from '@/lib/types'

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = createClient()
    console.log('Checking authentication status...')
    
    // Get the current session from auth state
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.warn('Session error:', sessionError.message)
    }
    
    if (session?.user?.id) {
      console.log('Found user session:', session.user.id)
      return session.user.id
    }
    
    // Fallback to getUser() if session not found
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      // Auth session missing is expected for unauthenticated users
      if (error.message !== 'Auth session missing!') {
        console.warn('Error getting current user:', error.message)
      }
      return null
    }
    
    if (user?.id) {
      console.log('Found authenticated user:', user.id)
      return user.id
    }
    
    console.warn('No authenticated user found')
    return null
  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

export async function fetchConversations(userId: string): Promise<ChatConversation[]> {
  try {
    if (!userId) {
      console.warn('fetchConversations: userId is empty')
      return []
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching conversations:', error.message, error.details)
      throw error
    }

    // Fetch messages for each conversation
    const conversationsWithMessages = await Promise.all(
      (data || []).map(async (conv) => {
        const { data: messages, error: msgError } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })

        if (msgError) {
          console.error('Supabase error fetching messages:', msgError.message, msgError.details)
          throw msgError
        }

        return {
          ...conv,
          messages: (messages || []).map(msg => ({
            id: msg.id,
            conversationId: msg.conversation_id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            createdAt: new Date(msg.created_at),
          })),
        } as ChatConversation
      })
    )

    return conversationsWithMessages
  } catch (error) {
    console.error('Error fetching conversations:', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function createConversationInDB(userId: string, title: string): Promise<ChatConversation | null> {
  try {
    if (!userId) {
      console.warn('createConversationInDB: userId is empty')
      return null
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert([
        {
          user_id: userId,
          title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error creating conversation:', error.message, error.details)
      throw error
    }

    return data?.[0]
      ? {
          id: data[0].id,
          userId: data[0].user_id,
          title: data[0].title,
          summary: data[0].summary,
          messages: [],
          createdAt: new Date(data[0].created_at),
          updatedAt: new Date(data[0].updated_at),
        }
      : null
  } catch (error) {
    console.error('Error creating conversation:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function saveChatMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessageType | null> {
  try {
    if (!conversationId) {
      console.warn('saveChatMessage: conversationId is empty')
      return null
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversationId,
          role,
          content,
          created_at: new Date().toISOString(),
        },
      ])
      .select()

    if (error) {
      console.error('Supabase error saving message:', error.message, error.details)
      throw error
    }

    return data?.[0]
      ? {
          id: data[0].id,
          conversationId: data[0].conversation_id,
          role: data[0].role as 'user' | 'assistant',
          content: data[0].content,
          createdAt: new Date(data[0].created_at),
        }
      : null
  } catch (error) {
    console.error('Error saving message:', error instanceof Error ? error.message : String(error))
    return null
  }
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('chat_conversations')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating conversation title:', error)
    return false
  }
}

export async function deleteConversationFromDB(conversationId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting conversation:', error)
    return false
  }
}
