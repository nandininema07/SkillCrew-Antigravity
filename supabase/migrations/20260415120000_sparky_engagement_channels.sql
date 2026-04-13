-- Sparky engagement: streak email/WhatsApp, optional daily voice digest, inactivity WhatsApp.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email_streak_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_streak BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_voice_daily_learning BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_inactivity BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_streak_reminder_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_streak_reminder_whatsapp_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_voice_daily_digest_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.notify_email_streak_reminders IS 'Sparky streak-at-risk emails (Resend; backend cron).';
COMMENT ON COLUMN public.profiles.notify_whatsapp_streak IS 'WhatsApp streak nudges when UTC day not yet logged (Twilio).';
COMMENT ON COLUMN public.profiles.notify_voice_daily_learning IS 'Opt-in: voice call with same daily learning recap as WhatsApp digest.';
COMMENT ON COLUMN public.profiles.notify_whatsapp_inactivity IS 'Short WhatsApp nudge alongside inactivity voice call.';
COMMENT ON COLUMN public.profiles.last_streak_reminder_email_at IS 'Dedupe streak emails (at most once per UTC day).';
COMMENT ON COLUMN public.profiles.last_streak_reminder_whatsapp_at IS 'Dedupe streak WhatsApp (at most once per UTC day).';
COMMENT ON COLUMN public.profiles.last_voice_daily_digest_at IS 'Last voice recap tied to daily digest (cooldown with digest).';
