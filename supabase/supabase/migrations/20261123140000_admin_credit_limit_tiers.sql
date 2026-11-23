-- MESITA-4733 — Admin › Payments › Credits Limit shows the tiers (MESITA-4732).
--
-- 1. place_credit_limit_tier(place, livemode): the limit a place earns from
--    its tier, ignoring its own limit: MXN 0 / MX$10,000 / MX$50,000 by
--    Credits Account and Stripe, other currencies their default. Same jsonb
--    shape as place_credit_limit_info (tier: none|credits|stripe|default).
-- 2. place_credit_limit_info(place, livemode): unchanged answer; now its own
--    limit wins, otherwise it IS place_credit_limit_tier. One source of truth.
-- 3. admin_credit_limits(livemode): each place also carries tier (what binds:
--    custom when its own limit), tier_limit_cents and tier_name (what it would
--    get without its own limit), so the page shows "MX$10,000 · Credits" and
--    "Use tier" puts a place back on its tier.

-- ── 1. The tier alone ───────────────────────────────────────────────────────
create or replace function public.place_credit_limit_tier(p_place_id uuid, p_livemode boolean)
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
             when f.currency is distinct from 'MXN' then 'default'
             when not f.credits_on then 'none'
             when not f.can_charge then 'credits'
             else 'stripe'
           end as tier
      from facts f
  )
  select jsonb_build_object(
    'limit_cents', case t.tier
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
revoke all on function public.place_credit_limit_tier(uuid, boolean) from public, anon, authenticated;
grant execute on function public.place_credit_limit_tier(uuid, boolean) to service_role;
comment on function public.place_credit_limit_tier(uuid, boolean) is
  'MESITA-4733: the Credit Limit a place earns from its tier, ignoring places.credit_limit_cents: MXN 0 with Credits Account Off, MX$10,000 On, MX$50,000 On with a charging Stripe account (p_livemode''s universe, null = either); other currencies credit_limit_defaults. Shape of place_credit_limit_info. Service role only.';

-- ── 2. The limit that binds: own limit, else the tier ───────────────────────
create or replace function public.place_credit_limit_info(p_place_id uuid, p_livemode boolean)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select case
           when p.credit_limit_cents is not null then jsonb_build_object(
             'limit_cents', p.credit_limit_cents,
             'currency', upper(p.currency),
             'tier', 'custom',
             'next', null)
           else public.place_credit_limit_tier(p.id, p_livemode)
         end
    from public.places p
   where p.id = p_place_id;
$function$;
revoke all on function public.place_credit_limit_info(uuid, boolean) from public, anon, authenticated;
grant execute on function public.place_credit_limit_info(uuid, boolean) to service_role;

-- ── 3. The admin page's read ────────────────────────────────────────────────
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
                    'loyalty_cards', sh.loyalty_cards,
                    'tier', public.place_credit_limit_info(sh.id, p_livemode) ->> 'tier',
                    'tier_limit_cents', (public.place_credit_limit_tier(sh.id, p_livemode) ->> 'limit_cents')::bigint,
                    'tier_name', public.place_credit_limit_tier(sh.id, p_livemode) ->> 'tier'))
                  from shown sh
                  left join public.place_profiles pp on pp.id = sh.id), '[]'::jsonb));
$function$;
comment on function public.admin_credit_limits(boolean) is
  'MESITA-3947/4732/4733 (operator): Admin › Payments › Credits Limit in one universe (p_livemode): the default per currency, and every place holding credit or with Loyalty Cards On, with outstanding credit, its own limit (override_cents), the limit that binds (limit_cents) and its tier (tier: what binds; tier_limit_cents and tier_name: without its own limit). Read by admin-web-get-credits-limit. Service role only.';
