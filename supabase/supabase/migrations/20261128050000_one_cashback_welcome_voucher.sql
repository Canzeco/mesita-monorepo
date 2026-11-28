-- MESITA-5124 (Pato, 2026-11-28): "Just one cashback. and the welcome thing is
-- the voucher, not the visit. that way we demonstrate that the first visit is
-- made with Mesita. Welcome Voucher (+30% or 60%) $100MX just one."
--
-- 1. ONE CASHBACK LINE. Every bill earns the place's one rate, the first
--    here like every later one. The rate stays in returning_bps (a renamed
--    column resets live config): Off · 5 %, and 10 % only where Small is
--    +20 %. welcome_bps stays so old readers parse; it holds 0 and accepts
--    only 0, like the VIP two (MESITA-5072). New bills are line 'returning';
--    a bill whose rate was frozen before this keeps the line and rate its
--    guest accepted, and old receipts keep reading 'welcome'.
-- 2. THE WELCOME VOUCHER IS BACK (a cashback line since MESITA-4698): pay the
--    currency's base (MX$100), bonus +30 % or +60 %, the place's pick in the
--    new column welcome_bonus_bps (default 3000), once per guest per place
--    (wallet_purchases_welcome_once_idx, never dropped). Its switch is
--    place_payment_settings.voucher_welcome, already there. A place that
--    sells a standard voucher today gets Welcome switched on.
-- 3. The ranking's offer points (catalog_rank_lanes, MESITA-5030) count the
--    Welcome voucher's bonus where it sells, and no longer a Welcome
--    Cashback. The body is 20261127090000's with that one line changed.
--
-- Rollback: drop welcome_bonus_bps; restore the welcome_bps checks
-- (0, 1000, 2000) and default 1000; re-run 20261128040000's three functions
-- and 20261127090000's catalog_rank_lanes.

-- ── 1. One cashback line ─────────────────────────────────────────────────────
update public.cashback_defaults set welcome_bps = 0 where welcome_bps <> 0;
update public.place_cashback_settings set welcome_bps = 0 where welcome_bps <> 0;

alter table public.cashback_defaults
  alter column welcome_bps set default 0,
  drop constraint if exists cashback_defaults_welcome_bps_check,
  add constraint cashback_defaults_welcome_bps_check check (welcome_bps = 0),
  add column if not exists welcome_bonus_bps integer not null default 3000,
  add constraint cashback_defaults_welcome_bonus_check check (welcome_bonus_bps in (3000, 6000));

alter table public.place_cashback_settings
  alter column welcome_bps set default 0,
  drop constraint if exists place_cashback_settings_welcome_bps_check,
  add constraint place_cashback_settings_welcome_bps_check check (welcome_bps = 0),
  add column if not exists welcome_bonus_bps integer not null default 3000,
  add constraint place_cashback_settings_welcome_bonus_check check (welcome_bonus_bps in (3000, 6000));

comment on column public.place_cashback_settings.welcome_bonus_bps is
  'MESITA-5124: the Welcome voucher''s bonus here, 3000 or 6000 basis points of its price. One per guest per place.';
comment on column public.place_cashback_settings.welcome_bps is
  'Retired (MESITA-5124): always 0. Cashback is one line, returning_bps.';

-- ── 2. Welcome on where vouchers already sell ────────────────────────────────
update public.place_payment_settings s
   set voucher_welcome = true, updated_at = now()
 where not s.voucher_welcome
   and s.loyalty_cards and s.prepayments
   and (s.voucher_200 or s.voucher_1000 or s.voucher_5000)
   and exists (select 1 from public.place_payment_accounts a
                where a.place_id = s.place_id and a.charges_enabled);

-- ── 3. The functions ─────────────────────────────────────────────────────────
-- Welcome and the VIP two always read 0 (the shape stays for its readers).
CREATE OR REPLACE FUNCTION public.place_cashback_rates(p_place_id uuid)
 RETURNS TABLE(welcome_bps integer, returning_bps integer, returning_vip_bps integer, welcome_vip_bps integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 0, coalesce(s.returning_bps, d.returning_bps, 500),
         0, 0
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_bill_quote(p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_bill_cents integer, p_tip_cents integer, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_line text;
  v_bps integer;
  r record;
  v_due integer;
  v_credit integer;
  v_back_bps integer := 0;
  v_back integer;
begin
  -- One line (MESITA-5124): every bill earns the place's one Cashback rate,
  -- the first here like every later one. The line keeps its stored name.
  v_line := 'returning';
  select * into r from public.place_cashback_rates(p_place_id);
  v_bps := greatest(coalesce(r.returning_bps, 0), 0);
  if exists (select 1 from public.place_payment_settings s
                 where s.place_id = p_place_id and s.loyalty_cards) then
    v_back_bps := v_bps;
  end if;
  v_due := p_bill_cents;
  select least(coalesce(b.spendable_cents, 0), v_due) into v_credit
    from public.wallet_balance(p_consumer_id, p_place_id, lower(p_currency), p_livemode, p_now) b;
  v_credit := greatest(coalesce(v_credit, 0), 0);
  v_back := ((v_due - v_credit)::bigint * v_back_bps / 10000)::integer;
  return jsonb_build_object(
    'line', v_line,
    'credit_cents', v_credit, 'outside_bill_cents', v_due - v_credit,
    'tip_cents', p_tip_cents, 'outside_cents', v_due - v_credit + p_tip_cents,
    'cashback_bps', v_back_bps,
    'cashback_cents', least(v_back, public.visit_cashback_cap_cents()),
    'cashback_capped', v_back > public.visit_cashback_cap_cents());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_line text;
  v_bps integer;
  r record;
  v_amount integer;
begin
  select * into t from public.pay_tabs where id = p_tab_id;
  if not found or t.status <> 'paid' or t.consumer_id is null then
    return 0;
  end if;
  -- The part not paid with credit, never the tip.
  v_earn := coalesce(t.cash_bill_cents, 0) + coalesce(t.card_bill_cents, 0);
  if v_earn <= 0 then
    return 0;
  end if;
  -- New credit is born only where Loyalty Cards is On (the signed agreement);
  -- a rate the guest accepted was frozen with that answer in it (MESITA-4823).
  if t.cashback_bps is null and not exists (select 1 from public.place_payment_settings s
                  where s.place_id = t.place_id and s.loyalty_cards) then
    return 0;
  end if;

  perform public.wallet_lock(t.consumer_id, t.place_id);

  if exists (select 1 from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback') then
    return 0;
  end if;

  -- One line (MESITA-5124): every bill earns the place's one Cashback rate.
  v_line := 'returning';

  -- A frozen rate keeps the line and rate its guest accepted.
  if t.cashback_bps is not null then
    v_line := coalesce(t.cashback_line, v_line);
  end if;
  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'returning' then r.returning_bps else 0 end;
  v_bps := coalesce(t.cashback_bps, v_bps);
  if v_bps <= 0 then
    return 0;
  end if;
  -- The ceiling of one bill (MESITA-4831).
  v_amount := least((v_earn::bigint * v_bps / 10000)::integer, public.visit_cashback_cap_cents());
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
end;
$function$
;

-- The ranking's offer points: the Welcome voucher's bonus where it sells.
create or replace function public.catalog_rank_lanes(
  p_lat double precision,
  p_lng double precision,
  p_organic_half_km double precision,
  p_organic_distance_exp double precision,
  p_organic_stars_exp double precision,
  p_organic_google_exp double precision,
  p_organic_premier_exp double precision,
  p_ad_half_km double precision,
  p_ad_distance_exp double precision,
  p_ad_stars_exp double precision,
  p_ad_google_exp double precision,
  p_ad_premier_exp double precision,
  p_premier_1 double precision,
  p_premier_2 double precision,
  p_families text[],
  p_known_families text[],
  p_require_active boolean,
  p_organic_fsq_factor double precision default 1,
  p_organic_fsq_exp double precision default 20,
  p_ad_fsq_factor double precision default 1,
  p_ad_fsq_exp double precision default 20,
  p_organic_offers_exp double precision default 0,
  p_ad_offers_exp double precision default 0
)
 returns jsonb
 language sql
 stable
 security invoker
 set search_path to 'public'
as $function$
  with growth as (
    select * from public.discovery_growth_bases(coalesce(p_require_active, false), p_known_families)
  ),
  cap as (
    select coalesce((
      select case
               when (c.discovery_config #>> '{params,mix,growthWeightCap}') ~ '^[0-9]+(\.[0-9]+)?$'
                 then least(0.8::double precision, greatest(0::double precision,
                        (c.discovery_config #>> '{params,mix,growthWeightCap}')::double precision))
               else 0.5::double precision
             end
        from public.app_config c
       where c.id = 1
    ), 0.5::double precision) as cap
  ),
  gated as (
    select p.id,
           p.lat::double precision as lat,
           p.lng::double precision as lng,
           p.google_stars_overall::double precision as stars,
           p.google_review_count::double precision as reviews,
           coalesce(p.boost_tier, 0) as tier,
           coalesce(p.family_keys, '{}'::text[]) as family_keys,
           p.foursquare_popularity::double precision as fsq,
           coalesce((
             select (
               case when coalesce(ps.prepayments, false) and coalesce(ps.voucher_200, false) then cb.small_bonus_bps else 0 end
               + case when coalesce(ps.prepayments, false) and coalesce(ps.voucher_1000, false) then cb.medium_bonus_bps else 0 end
               + case when coalesce(ps.prepayments, false) and coalesce(ps.voucher_5000, false) then cb.big_bonus_bps else 0 end
               + case when coalesce(ps.prepayments, false) and coalesce(ps.voucher_welcome, false) then cb.welcome_bonus_bps else 0 end
               + coalesce(cb.returning_bps, 0)
               + coalesce(cb.welcome_vip_bps, 0) + coalesce(cb.returning_vip_bps, 0)
             )::double precision / 100
               from public.place_cashback_settings cb
               left join public.place_payment_settings ps on ps.place_id = cb.place_id
              where cb.place_id = p.id
           ), 0) as offer_points
      from public.profiles p
     where p.state = 'active'
       and p.content_state = 'ready'
       and (not coalesce(p_require_active, false) or p.business_state = 'OPERATIONAL')
       and (coalesce(cardinality(p_families), 0) = 0 or p.family_keys && p_families)
  ),
  measured as (
    select g.*,
           case
             when p_lat is null or p_lng is null or g.lat is null or g.lng is null then null
             else 2 * 6371 * asin(least(1, sqrt(
               power(sin(radians(g.lat - p_lat) / 2), 2) +
               cos(radians(p_lat)) * cos(radians(g.lat)) *
               power(sin(radians(g.lng - p_lng) / 2), 2)
             )))
           end as km,
           (case g.tier when 2 then p_premier_2 when 1 then p_premier_1 else 1 end)::double precision as factor
      from gated g
     where g.family_keys && coalesce(p_known_families, '{}'::text[])
  ),
  parts as (
    select m.*,
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_organic_half_km is null or p_organic_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_organic_half_km, p_organic_distance_exp))
            end) as prox_organic,
           (case
              when p_lat is null or p_lng is null then 1
              when m.km is null then 0
              when m.km <= 0 then 1
              when p_ad_half_km is null or p_ad_half_km <= 0 then 0
              else 1 / (1 + power(m.km / p_ad_half_km, p_ad_distance_exp))
            end) as prox_ad,
           public.discovery_growth_weight(gr.elapsed_days, (select cap from cap), gr.kind) as w,
           case
             when m.stars is null or m.reviews is null or m.reviews <= 0 then 0::double precision
             else greatest(0::double precision, m.stars) * m.reviews
           end as established,
           coalesce(gr.growth_base, 0::double precision) as growth_base
      from measured m
      left join growth gr on gr.place_id = m.id
  ),
  scored as (
    select p.*,
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_organic_google_exp)
                   * public.discovery_foursquare_boost(p.fsq, p_organic_fsq_factor, p_organic_fsq_exp)
            end) as pop_organic,
           (case
              when p.established <= 0 then 0::double precision
              else power((1 - p.w) * p.established + p.w * p.growth_base, p_ad_google_exp)
                   * public.discovery_foursquare_boost(p.fsq, p_ad_fsq_factor, p_ad_fsq_exp)
            end) as pop_ad
      from parts p
  ),
  organic as (
    select x.id,
           x.km,
           x.prox_organic * x.pop_organic * power(x.factor, coalesce(p_organic_premier_exp, 0))
           * (case
                when coalesce(p_organic_offers_exp, 0) <= 0 then 1
                when x.offer_points <= 0 then 0
                else power(x.offer_points, p_organic_offers_exp)
              end) as final
      from scored x
  ),
  inorganic as (
    select x.id,
           x.km,
           x.prox_ad * x.pop_ad * power(x.factor, coalesce(p_ad_premier_exp, 0))
           * (case
                when coalesce(p_ad_offers_exp, 0) <= 0 then 1
                when x.offer_points <= 0 then 0
                else power(x.offer_points, p_ad_offers_exp)
              end) as final
      from scored x
     where x.tier in (1, 2)
  )
  select jsonb_build_object(
    'read', (select count(*) from gated),
    'ids', coalesce(
      (select jsonb_agg(o.id order by o.final desc nulls last, o.km asc nulls last, o.id::text collate "C" asc)
         from organic o),
      '[]'::jsonb),
    'premier', coalesce(
      (select jsonb_agg(i.id order by i.final desc nulls last, i.km asc nulls last, i.id::text collate "C" asc)
         from inorganic i),
      '[]'::jsonb),
    'inorganic_total', (select count(*) from inorganic)
  );
$function$;
