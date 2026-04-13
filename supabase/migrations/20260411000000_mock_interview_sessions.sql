-- Mock interviews: transcript stored server-side; analysis generated on demand.
-- Run in Supabase SQL Editor or via `supabase db push` if CLI is linked.

create table if not exists public.mock_interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_role text not null,
  transcript text not null,
  analysis_report text,
  vapi_assistant_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mock_interview_sessions_user_id_created_at_idx
  on public.mock_interview_sessions (user_id, created_at desc);

alter table public.mock_interview_sessions enable row level security;

create policy "mock_interview_sessions_select_own"
  on public.mock_interview_sessions for select
  using (auth.uid() = user_id);

create policy "mock_interview_sessions_insert_own"
  on public.mock_interview_sessions for insert
  with check (auth.uid() = user_id);

create policy "mock_interview_sessions_update_own"
  on public.mock_interview_sessions for update
  using (auth.uid() = user_id);
