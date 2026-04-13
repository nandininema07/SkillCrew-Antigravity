import { createClient } from '@/lib/supabase/server'
import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'
import { buildLearnerContextPayload, insertContextEvent } from '@/lib/server/learner-context'
import { normalizeArchieRoadmapBundle } from '@/lib/agents/normalize-roadmap'
import {
  getLastPassedWeek,
  normalizeWeekGateProgress,
  parseWeekNumberFromMilestoneId,
  PIP_PASS_THRESHOLD_PERCENT,
} from '@/lib/archie-week-gate'
import { updateRoadmapIntentBundleRaw } from '@/lib/server/persist-learning-roadmap'
import { isMissingSchemaObject } from '@/lib/server/supabase-schema-helpers'
import { XP_PIP_TEST_COMPLETION, xpFromPipScorePercent, levelFromXp } from '@/lib/gamification-xp'
import { perQuestionXpBreakdown, xpDeltaFromCheckpointResults } from '@/lib/roadmap-checkpoint-scoring'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { buildPipCheckpointEmailHtml } from '@/lib/email/pip-checkpoint-email-html'
import { sendPipCheckpointEmail } from '@/lib/server/send-pip-checkpoint-email'
import { NextResponse } from 'next/server'

type GradeResult = {
  question_id?: string
  correct?: boolean
  topic?: string
  difficulty?: string
  note?: string
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: roadmapId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      assessment: Record<string, unknown>
      answers: Record<string, { mcq_index?: number; text?: string }>
      roadmap_mode: 'skills' | 'job_ready'
      revise_on_weak?: boolean
      milestone_id?: string
    }

    if (body.roadmap_mode !== 'skills' && body.roadmap_mode !== 'job_ready') {
      return NextResponse.json({ error: 'Invalid roadmap_mode' }, { status: 400 })
    }
    if (!body.assessment || !body.answers) {
      return NextResponse.json({ error: 'assessment and answers required' }, { status: 400 })
    }
    const milestoneId = String(body.milestone_id || '').trim()
    if (!milestoneId) {
      return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 })
    }
    const quizWeek = parseWeekNumberFromMilestoneId(milestoneId)
    if (quizWeek == null || quizWeek < 1) {
      return NextResponse.json({ error: 'milestone_id must match week-N (e.g. week-1)' }, { status: 400 })
    }

    const { data: gateRow, error: gateErr } = await supabase
      .from('user_archie_roadmaps')
      .select('week_gate_progress')
      .eq('id', roadmapId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (gateErr || !gateRow) {
      return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
    }

    const gate = normalizeWeekGateProgress(gateRow.week_gate_progress)
    const lastPassed = getLastPassedWeek(gate, body.roadmap_mode)
    const expectedWeek = lastPassed + 1
    if (quizWeek !== expectedWeek) {
      return NextResponse.json(
        {
          error: `Pip quiz is only available for your current week (week ${expectedWeek}).`,
        },
        { status: 400 },
      )
    }

    const gradeRes = await proxyAgent('/pip/checkpoint/grade', {
      assessment: body.assessment,
      answers: body.answers,
    })
    if (!gradeRes.ok) {
      const err = await readProxyAgentError(gradeRes)
      return NextResponse.json({ error: err }, { status: gradeRes.status })
    }

    const gradeText = await gradeRes.text()
    let graded: {
      results?: GradeResult[]
      score_percent?: number
      weak_topics?: string[]
      pip_summary_for_archie?: string
      flashcard_suggestions?: { front?: string; back?: string }[]
    };
    try {
      graded = JSON.parse(gradeText) as {
        results?: GradeResult[]
        score_percent?: number
        weak_topics?: string[]
        pip_summary_for_archie?: string
        flashcard_suggestions?: { front?: string; back?: string }[]
      }
    } catch (e) {
      return NextResponse.json({ error: `Agent grade response was not valid JSON: ${gradeText}` }, { status: 502 })
    }

    const questions = Array.isArray(body.assessment.questions)
      ? (body.assessment.questions as Record<string, unknown>[])
      : []
    const diffById = new Map<string, string>()
    for (const q of questions) {
      const qid = String(q.id || '')
      if (qid) diffById.set(qid, String(q.difficulty || 'medium'))
    }

    const results = (graded.results || []).map((r) => ({
      correct: !!r.correct,
      difficulty: diffById.get(String(r.question_id || '')) || r.difficulty || 'medium',
    }))

    const perQuestionXp = perQuestionXpBreakdown(graded.results || [], diffById)

    const { gained, lost, net } = xpDeltaFromCheckpointResults(results)
    const scorePct =
      typeof graded.score_percent === 'number'
        ? graded.score_percent
        : results.length
          ? Math.round((results.filter((x) => x.correct).length / results.length) * 100)
          : 0

    const scoreBonusXp = xpFromPipScorePercent(scorePct)
    const pipActivityXp = XP_PIP_TEST_COMPLETION
    const totalXpDelta = net + scoreBonusXp + pipActivityXp

    const { data: profile } = await supabase.from('profiles').select('xp, level').eq('id', user.id).maybeSingle()
    const prevXp = typeof profile?.xp === 'number' ? profile.xp : 0
    const newXp = Math.max(0, prevXp + totalXpDelta)
    const newLevel = levelFromXp(newXp)

    const profilePatch = {
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    }
    const admin = createServiceRoleClient()
    const xpClient = admin ?? supabase
    const { error: xpErr } = await xpClient.from('profiles').update(profilePatch).eq('id', user.id)

    if (xpErr && !isMissingSchemaObject(xpErr.message)) {
      console.warn('profile xp update:', xpErr.message)
    }

    let weakTopics: string[] = Array.isArray(graded.weak_topics)
      ? graded.weak_topics.map((t) => String(t).trim()).filter(Boolean)
      : []
    if (weakTopics.length === 0) {
      weakTopics = (graded.results || [])
        .filter((r) => !r.correct)
        .map((r) => String(r.topic || '').trim())
        .filter(Boolean)
    }

    const resultsPreview = (graded.results || []).slice(0, 24).map((r) => ({
      question_id: String(r.question_id || ''),
      correct: !!r.correct,
      topic: String(r.topic || '').trim(),
      note: String(r.note || '').trim().slice(0, 500),
    }))

    await insertContextEvent(supabase, user.id, 'pip', 'checkpoint_graded', {
      roadmap_id: roadmapId,
      roadmap_mode: body.roadmap_mode,
      score_percent: scorePct,
      xp_delta: totalXpDelta,
      xp_quiz_net: net,
      xp_score_bonus: scoreBonusXp,
      xp_pip_completion: pipActivityXp,
      weak_topics: weakTopics.slice(0, 12),
      milestone_id: milestoneId,
      week: quizWeek,
      pip_summary_for_archie: String(graded.pip_summary_for_archie || '').slice(0, 4000),
      flashcard_suggestions: Array.isArray(graded.flashcard_suggestions)
        ? graded.flashcard_suggestions.slice(0, 12)
        : [],
      results_preview: resultsPreview,
    })

    let weekAdvanced = false
    if (scorePct > PIP_PASS_THRESHOLD_PERCENT && quizWeek === lastPassed + 1) {
      const nextGate = {
        ...gate,
        [body.roadmap_mode]: { last_passed_week: Math.max(lastPassed, quizWeek) },
      }
      const { error: gateUpErr } = await supabase
        .from('user_archie_roadmaps')
        .update({ week_gate_progress: nextGate as never, updated_at: new Date().toISOString() })
        .eq('id', roadmapId)
        .eq('user_id', user.id)
      if (gateUpErr && !isMissingSchemaObject(gateUpErr.message)) {
        console.warn('week_gate_progress update:', gateUpErr.message)
      } else if (!gateUpErr) {
        weekAdvanced = true
      }
    }

    const kudos = scorePct >= 60 && net >= 0

    let revisedBundle: ReturnType<typeof normalizeArchieRoadmapBundle> | null = null

    const shouldRevise = body.revise_on_weak !== false && weakTopics.length > 0

    if (shouldRevise) {
      const { data: rm } = await supabase
        .from('user_archie_roadmaps')
        .select('bundles_raw, direction')
        .eq('id', roadmapId)
        .eq('user_id', user.id)
        .maybeSingle()

      const bundles = (rm?.bundles_raw || {}) as Record<string, unknown>
      const current_bundle = bundles[body.roadmap_mode] as Record<string, unknown> | undefined
      const direction = String(rm?.direction || '').trim()

      if (current_bundle && direction) {
        const learner = await buildLearnerContextPayload(supabase, user.id, {
          direction,
          roadmap_intent: body.roadmap_mode,
          roadmapId,
        })
        const adaptation_signals = {
          reason: 'checkpoint_weak_topics',
          weak_topics: weakTopics,
          pip_summary_for_archie: graded.pip_summary_for_archie || '',
          score_percent: scorePct,
        }
        const revRes = await proxyAgent('/archie/revise', {
          current_bundle,
          adaptation_signals,
          learner_context: { ...learner, roadmap_intent: body.roadmap_mode },
        })
        if (revRes.ok) {
          const revisedRaw = (await revRes.json()) as Record<string, unknown>
          revisedBundle = normalizeArchieRoadmapBundle(revisedRaw)
          try {
            await updateRoadmapIntentBundleRaw(supabase, user.id, roadmapId, body.roadmap_mode, revisedRaw)
          } catch (e) {
            console.warn('update bundle after revise:', e)
          }
        }
      }
    }

    const userEmail = user.email?.trim()
    if (userEmail) {
      const roadmapModeLabel = body.roadmap_mode === 'skills' ? 'Skills roadmap' : 'Job ready roadmap'
      try {
        const html = buildPipCheckpointEmailHtml({
          roadmapModeLabel,
          scorePercent: scorePct,
          xpNet: net,
          questions,
          answers: body.answers,
          gradedResults: graded.results || [],
          pipSummary: graded.pip_summary_for_archie,
          weakTopics,
          flashcards: graded.flashcard_suggestions,
        })
        const subject = `Pip quiz results — ${scorePct}% · ${roadmapModeLabel}`
        void sendPipCheckpointEmail({ toEmail: userEmail, subject, html }).then((r) => {
          if (!r.ok) console.warn('[pip] checkpoint email failed:', r.error)
        })
      } catch (e) {
        console.warn('[pip] checkpoint email build/send:', e)
      }
    }

    return NextResponse.json({
      graded,
      xp: {
        previous: prevXp,
        next: newXp,
        gained,
        lost,
        net: totalXpDelta,
        quiz_net: net,
        score_bonus: scoreBonusXp,
        pip_completion: pipActivityXp,
        per_question: perQuestionXp,
      },
      level: newLevel,
      kudos,
      week_advanced: weekAdvanced,
      pip_pass_threshold_percent: PIP_PASS_THRESHOLD_PERCENT,
      kudosMessage:
        scorePct >= 85
          ? 'Outstanding — you crushed this checkpoint!'
          : scorePct >= 60
            ? 'Nice work — you passed this checkpoint!'
            : undefined,
      revised: revisedBundle ? { bundle: revisedBundle } : null,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
