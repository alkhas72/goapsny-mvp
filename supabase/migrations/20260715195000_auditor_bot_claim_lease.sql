-- T3 correction: bounded processing lease for webhook idempotency claims.

alter table public.auditor_bot_processed_updates
  add column if not exists claim_owner text,
  add column if not exists claim_attempt text,
  add column if not exists lease_expires_at timestamptz;

create index if not exists auditor_bot_processed_updates_lease_idx
  on public.auditor_bot_processed_updates (lease_expires_at)
  where status = 'processing';
