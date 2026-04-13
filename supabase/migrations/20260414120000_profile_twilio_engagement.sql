-- Opt-in flags + idempotency timestamps for Twilio WhatsApp daily digest and inactivity voice calls.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_whatsapp_digest BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_voice_reengagement BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_whatsapp_digest_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inactivity_call_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.notify_whatsapp_digest IS 'Receive daily WhatsApp summary of learning activity (backend cron).';
COMMENT ON COLUMN public.profiles.notify_voice_reengagement IS 'Allow voice call when inactive 3+ days (backend cron).';
COMMENT ON COLUMN public.profiles.last_whatsapp_digest_at IS 'Last time a daily digest was sent (dedupe).';
COMMENT ON COLUMN public.profiles.last_inactivity_call_at IS 'Last inactivity re-engagement call (cooldown).';
