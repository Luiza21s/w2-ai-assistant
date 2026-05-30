-- Выполните этот SQL в Supabase SQL Editor

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Новый чат',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  is_task boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on public.messages(session_id);

alter table public.sessions enable row level security;
alter table public.messages enable row level security;

create policy "Allow public access to sessions"
  on public.sessions
  for all
  using (true)
  with check (true);

create policy "Allow public access to messages"
  on public.messages
  for all
  using (true)
  with check (true);
