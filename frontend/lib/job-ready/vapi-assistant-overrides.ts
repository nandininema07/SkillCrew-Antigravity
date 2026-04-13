/**
 * Per-call Vapi overrides so the assistant knows the real target role from Command Center.
 * Dashboard templates often use Liquid: {{ targetRole }}, {{ role }}, etc.
 * `artifactPlan.videoRecordingEnabled` turns on the user camera for web calls and server-side
 * video artifacts (see Vapi Web SDK — Daily `videoSource` follows this flag).
 * @see https://docs.vapi.ai/assistants/dynamic-variables
 */

type AssistantOverrides = {
  variableValues?: Record<string, string>
  firstMessage?: string
  artifactPlan?: { videoRecordingEnabled?: boolean }
}

/** Set `NEXT_PUBLIC_VAPI_VIDEO_RECORDING=false` to run audio-only (no camera / no video artifact). */
export function isVapiVideoRecordingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VAPI_VIDEO_RECORDING !== 'false'
}

export function buildVapiAssistantOverrides(targetRole: string): AssistantOverrides | undefined {
  const role = targetRole.trim()
  if (!role) return undefined

  const base: AssistantOverrides = {
    variableValues: {
      targetRole: role,
      TargetRole: role,
      role: role,
      jobTitle: role,
      position: role,
      job_title: role,
      jobRole: role,
      'target role': role,
    },
    firstMessage: `Hi — I'm your interviewer for the ${role} role today. When you're ready, give me a short overview of your background and what you want to focus on in this practice session.`,
  }

  if (isVapiVideoRecordingEnabled()) {
    base.artifactPlan = {
      videoRecordingEnabled: true,
    }
  }

  return base
}
