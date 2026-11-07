-- MESITA-3299 — Discounts are gone (Pato, 2026-11-06: "discounts are gone
-- across all the app. no coupons nor shit"; Main § 2 to § 5 name the money
-- products: Digital Payments, Payments Cashback, Prepaid Vouchers).
--
-- The discount product of MESITA-3202 (a place's reward switches, the guest's
-- visit code, the shared visit staff close at visit.mesita.ai, the visit log)
-- leaves whole: five tables and every place_reward* / place_visit* function.
-- All had 0 rows on 2026-11-06. The place code survives in its own table: six
-- digits staff will type at visit.mesita.ai for the proof and the waiter's
-- charge (MESITA-3272), set on Business › Settings.

-- ── The place code, kept ─────────────────────────────────────────────────
create table public.place_codes (
  place_id uuid primary key references public.places (id) on delete cascade,
  code_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.place_codes is
  'MESITA-3299: the hash of a place''s six-digit staff code (was place_rewards.place_code_hash). Set on Business › Settings, typed at visit.mesita.ai. EF-only.';

alter table public.place_codes enable row level security;
revoke all on table public.place_codes from public, anon, authenticated;
grant all on table public.place_codes to service_role;

insert into public.place_codes (place_id, code_hash, updated_at, updated_by)
select place_id, place_code_hash, updated_at, updated_by
from public.place_rewards
where place_code_hash is not null;

-- ── The discount product, gone ───────────────────────────────────────────
drop table if exists public.place_visits cascade;
drop table if exists public.place_visit_codes cascade;
drop table if exists public.place_code_tries cascade;
drop table if exists public.visit_member_tries cascade;
drop table if exists public.place_rewards cascade;

-- Every function of the product, whatever its signature today: the overloads
-- changed migration by migration, so they are found by name, not spelled.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'place\_visit\_%' or p.proname like 'place\_reward%')
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

-- Post-flight: nothing of the product remains, and the code table is locked down.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('place_visits', 'place_visit_codes', 'place_code_tries', 'visit_member_tries', 'place_rewards')
  ) then
    raise exception 'a discount table survived MESITA-3299';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'place\_visit\_%' or p.proname like 'place\_reward%')
  ) then
    raise exception 'a discount function survived MESITA-3299';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'place_codes' and c.relrowsecurity
  ) then
    raise exception 'place_codes missing or RLS off after apply';
  end if;
end $$;
