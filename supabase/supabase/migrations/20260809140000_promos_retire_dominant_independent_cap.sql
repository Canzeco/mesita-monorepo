-- Promos: retire Dominant; discount cap is an independent place param.
--
-- Product (2026-08-09, Pato):
--   Strategies = Zero · Conservative · Aggressive only. NO Dominant.
--   Discount cap is a SEPARATE knob with options 200 / 500 / 1000.
--
-- Data moves:
--   1) Places on Dominant rates (40/50/20/30) → Aggressive (30/50/10/30).
--   2) monthly_promo_cap 2000 → 1000; illegal values snapped to nearest legal.
--   3) reward_rules: delete Dominant rows; tighten CHECK.
--   4) scoring_config.rp: drop dominant; Aggressive is the peak rung (1.0).
--   5) rewards_config blob: strip dominant cells (legacy mirror).

-- ─── 1. Remap Dominant places → Aggressive ──────────────────────────────
update public.projects
set
  welcome_free_rate = 30,
  welcome_premium_rate = 50,
  free_rate = 10,
  premium_rate = 30
where welcome_free_rate = 40
  and welcome_premium_rate = 50
  and free_rate = 20
  and premium_rate = 30;

-- Coupons that still carry Dominant rate tuples → Aggressive.
update public.coupons
set
  welcome_free_rate = 30,
  welcome_premium_rate = 50,
  free_rate = 10,
  premium_rate = 30
where welcome_free_rate = 40
  and welcome_premium_rate = 50
  and free_rate = 20
  and premium_rate = 30;

-- Open tickets snapshotted on Dominant → Aggressive (live pricing match).
update public.tickets
set
  welcome_free_rate = 30,
  welcome_premium_rate = 50,
  free_rate = 10,
  premium_rate = 30
where welcome_free_rate = 40
  and welcome_premium_rate = 50
  and free_rate = 20
  and premium_rate = 30
  and status in ('open', 'awaiting_payment_confirm');

-- ─── 2. Cap ladder: only 200 / 500 / 1000 (or null) ─────────────────────
update public.projects
set monthly_promo_cap = 1000
where monthly_promo_cap = 2000;

update public.projects
set monthly_promo_cap = case
  when monthly_promo_cap is null then null
  when monthly_promo_cap <= 350 then 200
  when monthly_promo_cap <= 750 then 500
  else 1000
end
where monthly_promo_cap is not null
  and monthly_promo_cap not in (200, 500, 1000);

alter table public.projects
  drop constraint if exists projects_monthly_promo_cap_legal_values;

alter table public.projects
  drop constraint if exists projects_monthly_promo_cap_check;

alter table public.projects
  add constraint projects_monthly_promo_cap_legal_values
  check (monthly_promo_cap is null or monthly_promo_cap = any (array[200, 500, 1000]));

comment on column public.projects.monthly_promo_cap is
  'Per-visit discount cap in place currency (MXN). Independent of strategy. Legal: 200, 500, 1000, or null (Zero / no promo).';

-- ─── 3. reward_rules: Dominant out ──────────────────────────────────────
delete from public.reward_rules where strategy = 'dominant';

alter table public.reward_rules
  drop constraint if exists reward_rules_strategy_check;

alter table public.reward_rules
  add constraint reward_rules_strategy_check
  check (strategy in ('conservative', 'aggressive'));

-- ─── 4. scoring_config.rp — three rungs; Aggressive = peak ──────────────
update public.app_settings
set scoring_config = jsonb_set(
  scoring_config,
  '{rp}',
  jsonb_build_object(
    'zero', coalesce((scoring_config -> 'rp' ->> 'zero')::numeric, 0.1),
    'conservative', coalesce((scoring_config -> 'rp' ->> 'conservative')::numeric, 0.4),
    'aggressive', 1.0
  ),
  true
)
where id = 1;

-- ─── 5. rewards_config blob — strip dominant cells; snap cap ────────────
update public.app_settings
set rewards_config = (
  with
  snapped_cap as (
    select case
      when (rewards_config ->> 'cap')::numeric is null then 500
      when (rewards_config ->> 'cap')::numeric <= 350 then 200
      when (rewards_config ->> 'cap')::numeric <= 750 then 500
      else 1000
    end as cap
  ),
  strip_rates as (
    select
      key,
      (value - 'dominant') as cleaned
    from jsonb_each(coalesce(rewards_config -> 'grid', '{}'::jsonb))
  ),
  new_grid as (
    select coalesce(jsonb_object_agg(key, cleaned), '{}'::jsonb) as grid
    from strip_rates
  ),
  strip_actions as (
    select
      a.key as action,
      coalesce(
        (
          select jsonb_object_agg(c.key, c.value - 'dominant')
          from jsonb_each(a.value) as c(key, value)
        ),
        '{}'::jsonb
      ) as cleaned
    from jsonb_each(coalesce(rewards_config -> 'actions', '{}'::jsonb)) as a(key, value)
  ),
  new_actions as (
    select coalesce(jsonb_object_agg(action, cleaned), '{}'::jsonb) as actions
    from strip_actions
  )
  select jsonb_build_object(
    'cap', (select cap from snapped_cap),
    'grid', (select grid from new_grid),
    'actions', (select actions from new_actions)
  )
)
where id = 1
  and rewards_config is not null;
