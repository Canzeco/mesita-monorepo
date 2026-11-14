-- MESITA-3947 CREDITS LIMIT (Pato, 2026-11-14: "in Admin Payments create a
-- page called Credits Limit. is the limit each place can accept ... The
-- default changes for each country/currency ... $100,000 MX for restaurants.
-- and $10,000 for US Restaurants ... and canada invent the fucking number").
--
-- The limit is the most House Credits a place may owe its guests at once:
-- what wallet_place_outstanding counts (Available + Pending, every guest,
-- plus open gift links), in the place's one currency. A voucher buy that
-- would pass it is refused (_shared/vouchers.ts, code place_cap). Cashback
-- is never refused: it is small and paid for by the place's own bill.
--
-- 1. credit_limit_defaults: one row per currency, the default limit in
--    cents (the same ×100 minor unit every money column uses, JPY included).
--    Seeded for the ten currencies of currency_for_country.
-- 2. places.credit_limit_cents: the place's own limit, null = its
--    currency's default.
-- 3. place_credit_limit(place): the limit that binds the place now, or
--    null when neither exists (the buy path then refuses: fail closed).
-- 4. admin_set_place_credit_limit: the one writer of the override.
-- 5. admin_credit_limits(livemode): the admin page's read, the defaults and
--    every place holding credit or with House Credits On.
--
-- Replaces the MX$20,000 test-mode cap (PLACE_CAP_CENTS, MESITA-3305) in
-- both universes. Additive: nothing reads the new objects until the EFs
-- deploy a few minutes after this applies.

-- ── 1. Defaults per currency ────────────────────────────────────────────────
create table if not exists public.credit_limit_defaults (
  currency text primary key check (currency ~ '^[A-Z]{3}$'),
  limit_cents bigint not null check (limit_cents >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.credit_limit_defaults enable row level security;
revoke all on table public.credit_limit_defaults from anon, authenticated;
comment on table public.credit_limit_defaults is
  'MESITA-3947: the default Credits Limit per currency (cents): the most House Credits a place in that currency may owe its guests at once. Edited from Admin › Payments › Credits Limit (admin-web-save-credits-limit). Service role only.';

insert into public.credit_limit_defaults (currency, limit_cents) values
  ('MXN',      100000 * 100::bigint),
  ('USD',       10000 * 100::bigint),
  ('CAD',       15000 * 100::bigint),
  ('EUR',       10000 * 100::bigint),
  ('GBP',        8000 * 100::bigint),
  ('BRL',       50000 * 100::bigint),
  ('JPY',     1500000 * 100::bigint),
  ('COP',    40000000 * 100::bigint),
  ('CLP',    10000000 * 100::bigint),
  ('PEN',       35000 * 100::bigint)
on conflict (currency) do nothing;

-- ── 2. The per-place override ───────────────────────────────────────────────
alter table public.places add column if not exists credit_limit_cents bigint
  check (credit_limit_cents is null or credit_limit_cents >= 0);
comment on column public.places.credit_limit_cents is
  'MESITA-3947: this place''s own Credits Limit in cents; null = credit_limit_defaults for its currency. Written only by admin-web-save-credits-limit.';

-- ── 3. The limit that binds a place ─────────────────────────────────────────
create or replace function public.place_credit_limit(p_place_id uuid)
 returns bigint
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(p.credit_limit_cents, d.limit_cents)
    from public.places p
    left join public.credit_limit_defaults d on d.currency = upper(p.currency)
   where p.id = p_place_id;
$function$;
revoke all on function public.place_credit_limit(uuid) from public, anon, authenticated;
grant execute on function public.place_credit_limit(uuid) to service_role;
comment on function public.place_credit_limit(uuid) is
  'MESITA-3947: the place''s Credits Limit in cents (its own, else its currency''s default), null when neither exists. Read by the voucher buy (_shared/vouchers.ts). Service role only.';

-- The one writer of places.credit_limit_cents (a raw places write from an EF
-- is refused by write-surface.test.ts). False when the place does not exist.
create or replace function public.admin_set_place_credit_limit(p_place_id uuid, p_limit_cents bigint)
 returns boolean
 language sql
 volatile
 security definer
 set search_path to 'public'
as $function$
  with u as (
    update public.places set credit_limit_cents = p_limit_cents where id = p_place_id returning 1
  )
  select exists (select 1 from u);
$function$;
revoke all on function public.admin_set_place_credit_limit(uuid, bigint) from public, anon, authenticated;
grant execute on function public.admin_set_place_credit_limit(uuid, bigint) to service_role;
comment on function public.admin_set_place_credit_limit(uuid, bigint) is
  'MESITA-3947: sets one place''s own Credits Limit in cents (null = its currency''s default); false when no such place. Called only by admin-web-save-credits-limit. Service role only.';

-- ── 5. The admin page's read ────────────────────────────────────────────────
create or replace function public.admin_credit_limits(p_livemode boolean)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with owed as (
    select place_id, currency, amount_cents::bigint as cents
      from public.wallet_entries where livemode = p_livemode
    union all
    select place_id, currency, amount_cents::bigint
      from public.wallet_gifts where livemode = p_livemode and status = 'open'
  ),
  totals as (
    select o.place_id, sum(o.cents)::bigint as outstanding_cents
      from owed o
      join public.places p on p.id = o.place_id and o.currency = lower(p.currency)
     group by o.place_id
  ),
  shown as (
    select p.id, p.currency, p.credit_limit_cents,
           coalesce(t.outstanding_cents, 0) as outstanding_cents,
           coalesce(s.house_credits, false) as house_credits
      from public.places p
      left join totals t on t.place_id = p.id
      left join public.place_payment_settings s on s.place_id = p.id
     where coalesce(t.outstanding_cents, 0) <> 0 or coalesce(s.house_credits, false)
  )
  select jsonb_build_object(
    'defaults', coalesce((select jsonb_agg(jsonb_build_object(
                    'currency', d.currency, 'limit_cents', d.limit_cents, 'updated_at', d.updated_at)
                    order by d.currency) from public.credit_limit_defaults d), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object(
                    'place_id', sh.id,
                    'place_name', coalesce(nullif(pp.name, ''), pp.google_name),
                    'currency', upper(sh.currency),
                    'outstanding_cents', sh.outstanding_cents,
                    'override_cents', sh.credit_limit_cents,
                    'limit_cents', coalesce(sh.credit_limit_cents, d.limit_cents),
                    'house_credits', sh.house_credits))
                  from shown sh
                  left join public.place_profiles pp on pp.id = sh.id
                  left join public.credit_limit_defaults d on d.currency = upper(sh.currency)), '[]'::jsonb));
$function$;
revoke all on function public.admin_credit_limits(boolean) from public, anon, authenticated;
grant execute on function public.admin_credit_limits(boolean) to service_role;
comment on function public.admin_credit_limits(boolean) is
  'MESITA-3947 (operator): Admin › Payments › Credits Limit in one universe (p_livemode, the EF''s STRIPE_MODE): the default per currency, and every place holding credit or with House Credits On, with its outstanding credit (wallet_place_outstanding''s sum, in the place''s currency), its own limit and the limit that binds it. Read by admin-web-get-credits-limit. Service role only.';

-- A database reset keeps the limits Mesita set (operator config, not data).
insert into public.admin_reset_preserve (table_name, reason) values
  ('credit_limit_defaults', 'Credits Limit per currency, set by Mesita from Admin (MESITA-3947)')
on conflict (table_name) do update set reason = excluded.reason;
