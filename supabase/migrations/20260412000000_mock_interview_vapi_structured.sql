-- Vapi web call id (for structured output fetch) + cached structured JSON from GET /call/:id
alter table public.mock_interview_sessions
  add column if not exists vapi_call_id text,
  add column if not exists vapi_structured_output jsonb;

comment on column public.mock_interview_sessions.vapi_call_id is 'Vapi GET /call/{id} id from web SDK (call-start-success)';
comment on column public.mock_interview_sessions.vapi_structured_output is 'Cached artifact.structuredOutputs from Vapi after call completes';
