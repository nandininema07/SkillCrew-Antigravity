/**
 * HTML body for Pip checkpoint summary emails (Resend).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type GradedResult = {
  question_id?: string
  correct?: boolean
  topic?: string
  note?: string
}

type QuestionRow = Record<string, unknown>

export function buildPipCheckpointEmailHtml(args: {
  roadmapModeLabel: string
  scorePercent: number
  xpNet: number | null
  questions: QuestionRow[]
  answers: Record<string, { mcq_index?: number; text?: string }>
  gradedResults: GradedResult[]
  pipSummary?: string
  weakTopics?: string[]
  flashcards?: { front?: string; back?: string }[]
}): string {
  const {
    roadmapModeLabel,
    scorePercent,
    xpNet,
    questions,
    answers,
    gradedResults,
    pipSummary,
    weakTopics,
    flashcards,
  } = args

  const resultByQid = new Map<string, GradedResult>()
  for (const r of gradedResults) {
    const id = String(r.question_id || '')
    if (id) resultByQid.set(id, r)
  }

  const rows: string[] = []
  let qi = 0
  for (const q of questions) {
    qi += 1
    const qid = String(q.id || '')
    const kind = String(q.kind || 'mcq').toLowerCase()
    const prompt = escapeHtml(String(q.prompt || ''))
    const topic = escapeHtml(String(q.topic || ''))
    const choices = Array.isArray(q.choices) ? (q.choices as string[]) : []
    const ans = answers[qid]
    const gr = resultByQid.get(qid)
    const ok = gr?.correct === true ? 'Correct' : gr?.correct === false ? 'Incorrect' : '—'
    const pipNote = gr?.note ? escapeHtml(String(gr.note)) : ''

    let answerBlock = ''
    if ((kind === 'mcq' || kind === '') && choices.length >= 2) {
      const idx = ans?.mcq_index
      const picked =
        typeof idx === 'number' && idx >= 0 && idx < choices.length ? escapeHtml(choices[idx]) : '—'
      const choicesHtml = choices
        .map((c, i) => `<li style="margin:4px 0">${i + 1}. ${escapeHtml(c)}</li>`)
        .join('')
      answerBlock = `
        <p style="margin:8px 0 4px;font-size:13px;color:#444"><strong>Your choice:</strong> ${picked}</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#444">${choicesHtml}</ul>`
    } else {
      const raw = (ans?.text || '').trim()
      const snippet = raw.length > 6000 ? `${raw.slice(0, 6000)}…` : raw
      answerBlock = `<pre style="background:#f6f6f6;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word">${escapeHtml(snippet || '(empty)')}</pre>`
    }

    rows.push(`
      <tr>
        <td style="padding:16px;border-bottom:1px solid #eee;vertical-align:top">
          <p style="margin:0 0 6px;font-size:12px;color:#666">Question ${qi}${topic ? ` · ${topic}` : ''}</p>
          <p style="margin:0 0 10px;font-size:15px;color:#111">${prompt}</p>
          ${answerBlock}
          <p style="margin:10px 0 0;font-size:13px"><strong>Pip:</strong> ${ok}${pipNote ? ` — ${pipNote}` : ''}</p>
        </td>
      </tr>
    `)
  }

  const weakHtml =
    weakTopics && weakTopics.length > 0
      ? `<p style="margin:16px 0 8px;font-size:14px"><strong>Topics to review:</strong> ${escapeHtml(weakTopics.join(', '))}</p>`
      : ''

  const flashHtml =
    flashcards && flashcards.length > 0
      ? `<div style="margin:16px 0;padding:12px;background:#fafafa;border-radius:8px;border:1px solid #eee">
          <p style="margin:0 0 8px;font-size:14px"><strong>Flashcards Pip suggests</strong></p>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:#333">
            ${flashcards
              .slice(0, 8)
              .map(
                (f) =>
                  `<li style="margin:6px 0"><strong>${escapeHtml(String(f.front || ''))}</strong> → ${escapeHtml(String(f.back || ''))}</li>`,
              )
              .join('')}
          </ul>
        </div>`
      : ''

  const archieHtml = pipSummary
    ? `<div style="margin:16px 0;padding:12px;background:#f0f7ff;border-radius:8px;border:1px solid #cfe8ff">
        <p style="margin:0 0 6px;font-size:12px;color:#036"><strong>Note for your learning path</strong></p>
        <p style="margin:0;font-size:13px;color:#333">${escapeHtml(pipSummary)}</p>
      </div>`
    : ''

  const xpLine =
    xpNet != null
      ? `<p style="margin:8px 0;font-size:14px"><strong>XP change this run:</strong> ${xpNet >= 0 ? '+' : ''}${xpNet}</p>`
      : ''

  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:640px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 8px">Your Pip quiz results</h1>
  <p style="margin:0 0 6px;font-size:14px;color:#555">${escapeHtml(roadmapModeLabel)}</p>
  <p style="margin:0 0 16px;font-size:16px"><strong>Score:</strong> ${scorePercent}%</p>
  ${xpLine}
  ${archieHtml}
  ${weakHtml}
  ${flashHtml}
  <h2 style="font-size:16px;margin:24px 0 8px;font-weight:600">Questions &amp; your answers</h2>
  <table style="width:100%;border-collapse:collapse">${rows.join('')}</table>
  <p style="margin:24px 0 0;font-size:12px;color:#888">Sent by Pip (SkillCrew). Reply is not monitored.</p>
</body>
</html>`
}
