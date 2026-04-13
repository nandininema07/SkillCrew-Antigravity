import { proxyAgent, readProxyAgentError } from '@/lib/server/agent-backend-proxy'

export async function sendPipCheckpointEmail(opts: {
  toEmail: string
  subject: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await proxyAgent('/email/pip-checkpoint-summary', {
    to_email: opts.toEmail,
    subject: opts.subject,
    html: opts.html,
  })
  if (!res.ok) {
    const err = await readProxyAgentError(res)
    return { ok: false, error: err }
  }
  return { ok: true }
}
