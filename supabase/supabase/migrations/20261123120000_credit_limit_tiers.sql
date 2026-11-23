-- MESITA-4732 — CREDIT LIMIT TIERS (Pato, 2026-11-23, design review D1–D4).
--
-- The Credit Limit (MESITA-3947) is the most credit a place may owe its
-- guests at once. Until now a place took its own limit, else its currency's
-- default (MX$100,000 for Mexico). From now on a Mexican place earns its
-- limit in steps:
--
--   own limit (places.credit_limit_cents, set from Admin)  → it, always wins
--   MXN, Credits Account (loyalty_cards) Off                → 0: no new credit
--   MXN, Credits Account On                                 → MX$10,000
--   MXN, Credits Account On and a Stripe account that can
--        charge (charges_enabled)                            → MX$50,000
--   any other currency                                       → credit_limit_defaults, as before
--
-- 1. place_credit_limit_info(place, livemode): the one source of truth, as
--    jsonb { limit_cents, currency, tier, next }. tier is none | credits |
--    stripe | custom | default; next is the step that raises the limit,
--    { step: credits | stripe, limit_cents }, or null. p_livemode picks the
--    universe whose Stripe account counts; null = either, because SQL
--    cannot see the server's payments mode (the same rule as
--    place_payment_settings_stripe_guard). business-web-get-payments passes
--    its mode; place_credit_limit passes null.
-- 2. place_credit_limit(place): same signature, volatility, security and
--    grants; now the info's limit_cents. The voucher buy (_shared/vouchers.ts)
--    reads it; a null limit still refuses (fail closed).
-- 3. admin_credit_limits(livemode): its limit_cents is the tiered limit in
--    the page's universe, so Admin › Credits Limit shows what binds.
--
-- credit_limit_defaults keeps its MXN row (the Admin page still edits it),
-- but no Mexican place reads it any more: the tiers replace it.

-- ── 1. The one source of truth ──────────────────────────────────────────────
create or replace function public.place_credit_limit_info(p_place_id uuid, p_livemode boolean)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with facts as (
    select upper(p.currency) as currency,
           p.credit_limit_cents,
           d.limit_cents as default_cents,
           coalesce(s.loyalty_cards, false) as credits_on,
           exists (
             select 1 from public.place_payment_accounts a
              where a.place_id = p.id and a.charges_enabled
                and (p_livemode is null or a.livemode = p_livemode)
           ) as can_charge
      from public.places p
      left join public.place_payment_settings s on s.place_id = p.id
      left join public.credit_limit_defaults d on d.currency = upper(p.currency)
     where p.id = p_place_id
  ),
  tiered as (
    select f.*,
           case
             when f.credit_limit_cents is not null then 'custom'
             when f.currency is distinct from 'MXN' then 'default'
             when not f.credits_on then 'none'
             when not f.can_charge then 'credits'
             else 'stripe'
           end as tier
      from facts f
  )
  select jsonb_build_object(
    'limit_cents', case t.tier
                     when 'custom'  then t.credit_limit_cents
                     when 'default' then t.default_cents
                     when 'none'    then 0::bigint
                     when 'credits' then 1000000::bigint   -- MX$10,000
                     else                5000000::bigint   -- MX$50,000
                   end,
    'currency', t.currency,
    'tier', t.tier,
    'next', case t.tier
              -- Turning the Credits Account on with a charging Stripe
              -- account already there lands straight on MX$50,000.
              when 'none' then jsonb_build_object(
                'step', 'credits',
                'limit_cents', case when t.can_charge then 5000000::bigint else 1000000::bigint end)
              when 'credits' then jsonb_build_object('step', 'stripe', 'limit_cents', 5000000::bigint)
              else null
            end)
    from tiered t;
$function$;
revoke all on function public.place_credit_limit_info(uuid, boolean) from public, anon, authenticated;
grant execute on function public.place_credit_limit_info(uuid, boolean) to service_role;
comment on function public.place_credit_limit_info(uuid, boolean) is
  'MESITA-4732: the place''s Credit Limit and how it is reached, as { limit_cents, currency, tier: none|credits|stripe|custom|default, next: { step: credits|stripe, limit_cents } | null }; null when no such place. Own limit wins; MXN: 0 with Credits Account Off, MX$10,000 On, MX$50,000 On with a charging Stripe account (in p_livemode''s universe, null = either); other currencies: credit_limit_defaults. Read by place_credit_limit, admin_credit_limits and business-web-get-payments. Service role only.';

-- ── 2. The limit that binds (signature unchanged) ───────────────────────────
create or replace function public.place_credit_limit(p_place_id uuid)
 returns bigint
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select (public.place_credit_limit_info(p_place_id, null) ->> 'limit_cents')::bigint;
$function$;
revoke all on function public.place_credit_limit(uuid) from public, anon, authenticated;
grant execute on function public.place_credit_limit(uuid) to service_role;
comment on function public.place_credit_limit(uuid) is
  'MESITA-3947/4732: the place''s Credit Limit in cents (place_credit_limit_info''s limit_cents, a Stripe account in either universe counting), null when none exists. Read by the voucher buy (_shared/vouchers.ts). Service role only.';

-- ── 3. The admin page's read: the tiered limit ──────────────────────────────
create or replace function public.admin_credit_limits(p_livemode boolean)
returns jsonb
language sql
stable security definer
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
           coalesce(s.loyalty_cards, false) as loyalty_cards
      from public.places p
      left join totals t on t.place_id = p.id
      left join public.place_payment_settings s on s.place_id = p.id
     where coalesce(t.outstanding_cents, 0) <> 0 or coalesce(s.loyalty_cards, false)
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
                    'limit_cents', (public.place_credit_limit_info(sh.id, p_livemode) ->> 'limit_cents')::bigint,
                    'loyalty_cards', sh.loyalty_cards))
                  from shown sh
                  left join public.place_profiles pp on pp.id = sh.id), '[]'::jsonb));
$function$;
comment on function public.admin_credit_limits(boolean) is
  'MESITA-3947/4732 (operator): Admin › Payments › Credits Limit in one universe (p_livemode, the EF''s STRIPE_MODE): the default per currency, and every place holding credit or with Loyalty Cards On, with its outstanding credit (wallet_place_outstanding''s sum, in the place''s currency), its own limit and the limit that binds it (place_credit_limit_info, tiered for MXN). Read by admin-web-get-credits-limit. Service role only.';
