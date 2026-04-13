-- Semantic cache for agent responses (coach, etc.). Use Supabase pooler (port 6543) for direct Postgres
-- clients; @supabase/supabase-js uses the HTTP API and is safe for concurrent serverless calls.

create extension if not exists vector;

create table if not exists public.agent_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_key text not null,
  input_hash text not null,
  input_preview text,
  embedding vector(1536),
  response jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_cache_user_agent_hash_idx
  on public.agent_cache (user_id, agent_key, input_hash);

create index if not exists agent_cache_embedding_ivfflat_idx
  on public.agent_cache
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

alter table public.agent_cache enable row level security;

create policy "agent_cache_select_own"
  on public.agent_cache for select
  using (auth.uid() = user_id);

create policy "agent_cache_insert_own"
  on public.agent_cache for insert
  with check (auth.uid() = user_id);

create policy "agent_cache_delete_own"
  on public.agent_cache for delete
  using (auth.uid() = user_id);

-- Similarity search: cosine distance <=> ; similarity = 1 - distance. Scoped to auth.uid().
create or replace function public.match_agent_cache(
  query_embedding vector(1536),
  match_agent text,
  match_threshold float,
  match_count int default 1
)
returns table (
  id uuid,
  response jsonb,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.response,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.agent_cache c
  where c.user_id = auth.uid()
    and c.agent_key = match_agent
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 5));
$$;

grant execute on function public.match_agent_cache(vector, text, float, int) to authenticated;
