-- T3: Telegram auditor bot — server-only session and idempotency tables.
-- RLS enabled; no anon/authenticated policies — service role only.
--
-- FIELD-DELTA-ANTIGRAVITY-2026-07-14 (9807c98): T3 session tables do not need
-- SECURITY DEFINER RPCs. If a future T3 migration adds/replaces one, it MUST use
-- SET search_path = '', fully qualified object names, and minimum grants — never
-- copy 0001's SET search_path = public pattern.

create table public.auditor_bot_sessions (
  telegram_id bigint primary key,
  state text not null default 'menu',
  draft jsonb not null default '{}'::jsonb,
  last_update_id bigint,
  updated_at timestamptz not null default now()
);

create table public.auditor_bot_processed_updates (
  update_id bigint primary key,
  status text not null check (status in ('processing', 'completed')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz
);

create index auditor_bot_sessions_updated_idx on public.auditor_bot_sessions (updated_at);
create index auditor_bot_processed_updates_status_idx on public.auditor_bot_processed_updates (status);

create trigger auditor_bot_sessions_set_updated_at
  before update on public.auditor_bot_sessions
  for each row execute function public.set_updated_at();

alter table public.auditor_bot_sessions enable row level security;
alter table public.auditor_bot_processed_updates enable row level security;
