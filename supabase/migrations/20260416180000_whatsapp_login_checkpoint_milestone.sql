-- WhatsApp opt-in for login welcome, Pip checkpoint scores, and milestone (node) progress nudges.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_whatsapp_login BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_checkpoint BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_milestone BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_whatsapp_login_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.notify_whatsapp_login IS 'WhatsApp welcome after dashboard session (deduped; Twilio).';
COMMENT ON COLUMN public.profiles.notify_whatsapp_checkpoint IS 'WhatsApp after Pip weekly checkpoint score (Twilio).';
COMMENT ON COLUMN public.profiles.notify_whatsapp_milestone IS 'WhatsApp when a roadmap milestone node is newly completed via modules (Twilio).';
COMMENT ON COLUMN public.profiles.last_whatsapp_login_at IS 'Last login-welcome WhatsApp sent (dedupe by UTC day in app).';

-- Dedupe Pip checkpoint WhatsApp per user + roadmap + milestone (retry-safe).
CREATE TABLE IF NOT EXISTS public.whatsapp_pip_checkpoint_sent (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  roadmap_id UUID NOT NULL,
  milestone_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, roadmap_id, milestone_id)
);

ALTER TABLE public.whatsapp_pip_checkpoint_sent ENABLE ROW LEVEL SECURITY;

-- No policies: clients cannot access; backend uses service role (bypasses RLS).
