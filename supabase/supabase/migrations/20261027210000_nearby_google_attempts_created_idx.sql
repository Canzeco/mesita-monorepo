-- MESITA-2870: the Nearby ledger's global minute and rolling-24 h counts
-- (_shared/nearby-google-quota.ts) range over created_at alone; the
-- (ip_hash, created_at) index cannot serve them.
create index if not exists nearby_google_attempts_created_idx
  on public.nearby_google_attempts (created_at desc);
