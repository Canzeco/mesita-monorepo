-- ============================================================================
-- Search Google-fill quota — per-IP attempts ledger (Places spend guard).
--
-- consumer-web-list-places is public (verify_jwt = false). Web Search POSTs
-- { google: true, lat, lng } and the EF spends GMP_KEY on five parallel
-- Nearby Search (New) calls. An in-isolate 15s cell cache and a 20/60s
-- isolate fan-out cap do not bind across isolates, so unique ~1 km cells
-- remain an independent billed budget per isolate.
--
-- Model: hashed IP (sha256(ip|yyyy-mm-dd|service salt), never the raw IP)
-- insert-then-count on a rolling 60s window BEFORE any Google spend
-- (_shared/nearby-google-quota.ts). Over quota skips Google fill and still
-- returns listed Mesita — Search stays up; Places quota does not.
--
-- EF-only table (service_role): RLS on, zero policies — the deliberate
-- lockdown pattern (accepted rls_enabled_no_policy INFO).
-- admin_reset_database() wipes this dynamically; do not recreate its body.
-- ============================================================================

create table if not exists public.nearby_google_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

comment on table public.nearby_google_attempts is
  'Per-IP Google Nearby fill attempts for consumer-web-list-places. Insert-then-count rolling 60s quota before GMP spend (_shared/nearby-google-quota.ts). EF-only (RLS, no policies; client privileges revoked).';

create index if not exists nearby_google_attempts_ip_created_idx
  on public.nearby_google_attempts (ip_hash, created_at desc);

alter table public.nearby_google_attempts enable row level security;
revoke all on table public.nearby_google_attempts from public, anon, authenticated;
grant all on table public.nearby_google_attempts to service_role;
revoke all on sequence public.nearby_google_attempts_id_seq from public, anon, authenticated;
grant all on sequence public.nearby_google_attempts_id_seq to service_role;

notify pgrst, 'reload schema';
