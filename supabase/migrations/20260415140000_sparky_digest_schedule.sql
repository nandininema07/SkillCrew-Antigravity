-- User-chosen local time + IANA timezone for daily learning digest (WhatsApp / voice). Triggered when user opens the app after this time.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sparky_digest_local_time TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS sparky_digest_timezone TEXT NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN public.profiles.sparky_digest_local_time IS 'HH:MM (24h) in sparky_digest_timezone — digest sends after this time when user visits the app.';
COMMENT ON COLUMN public.profiles.sparky_digest_timezone IS 'IANA zone id (e.g. Asia/Kolkata).';

COMMENT ON COLUMN public.profiles.notify_whatsapp_digest IS 'WhatsApp daily learning recap (after scheduled local time; Twilio).';
COMMENT ON COLUMN public.profiles.notify_voice_daily_learning IS 'Optional voice call with same recap; requires phone + TWILIO_VOICE_FROM.';

