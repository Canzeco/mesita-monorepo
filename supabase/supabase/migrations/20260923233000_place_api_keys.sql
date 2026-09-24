-- ============================================================================
-- Place API keys — one integration secret per place (MESITA-2062).
--
-- Model mirrors consumer_connectors: plaintext shown once at mint; only
-- sha256(token) + a short prefix stored. Revoke sets revoked_at.
-- EF-only (service_role): RLS on, zero policies.
-- ============================================================================

create table if not exists public.place_api_keys (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  key_prefix    text not null,
  key_hash      text not null unique,
  label         text not null default 'Integration',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  constraint place_api_keys_prefix_len check (char_length(key_prefix) between 8 and 24)
);

comment on table public.place_api_keys is
  'Place-scoped API keys for POS and agency integrations. Plaintext shown once at mint; only sha256 hash stored. EF-only (service_role).';

create index if not exists place_api_keys_place_idx
  on public.place_api_keys (place_id, created_at desc);

create index if not exists place_api_keys_hash_active_idx
  on public.place_api_keys (key_hash)
  where revoked_at is null;

alter table public.place_api_keys enable row level security;
revoke all on table public.place_api_keys from anon, authenticated;
grant all on table public.place_api_keys to service_role;

notify pgrst, 'reload schema';
