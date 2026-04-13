import { createClient } from '@/lib/supabase/server'
import { runCoachPipeline, postCoachSideEffects } from '@/lib/server/coach-pipeline'
import type { CoachRoutePlan } from '@/lib/agents/coach-router'

export const runtime = 'edge'

/**
 * NDJSON stream: UI can read lines as soon as each phase completes.
 * Format: one JSON object per line { type, ... }.
 */
export async function POST(request: Request) {
  const encoder = new TextEncoder()
  const body = (await request.json()) as {
    latest_user_message: string
    conversation_id?: string
  }

  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
      }

      try {
        push({ type: 'phase', phase: 'auth' })
        const supabase = await createClient()
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
          push({ type: 'error', message: 'Unauthorized' })
          controller.close()
          return
        }

        push({ type: 'phase', phase: 'parallel_context' })
        push({ type: 'phase', phase: 'cache_lookup' })

        const result = await runCoachPipeline(supabase, user, body)
        if ('error' in result) {
          push({ type: 'error', message: result.error, status: result.status })
          controller.close()
          return
        }

        const { coachOut, fromCache, router, direction } = result
        push({
          type: 'router',
          plan: router as unknown as CoachRoutePlan,
        })
        push({
          type: 'cache',
          hit: fromCache,
        })
        push({ type: 'phase', phase: 'coach_result' })
        push({ type: 'partial', coach: coachOut })

        push({ type: 'phase', phase: 'side_effects' })
        await postCoachSideEffects(
          supabase,
          user.id,
          body.latest_user_message.trim(),
          body.conversation_id,
          coachOut,
          direction,
        )

        push({
          type: 'complete',
          coach: coachOut,
          cache: fromCache ? 'hit' : 'miss',
        })
        controller.close()
      } catch (e) {
        push({
          type: 'error',
          message: e instanceof Error ? e.message : 'Internal server error',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
