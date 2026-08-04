-- Rewards v8 (MESITA-873): reward pricing goes NORMALIZED.
--
-- v13 stored two shapes in one jsonb blob — `grid[class][strategy]` for the
-- standing discount, `actions[action][class][strategy]` for everything else.
-- Pato's model makes "None (Standing)" just another ACTION, so all 60 rules
-- become one uniform relation: one row per (strategy × class × action).
-- Adding a future action (TikTok, Referral, Birthday) is then rows, not a
-- schema change — pricing becomes data. NOTE the honest limit: eligibility
-- stays code, since the engine must know what verified signal gates a new
-- action.
--
-- The cap deliberately does NOT live here: it is one platform-wide scalar,
-- not a rule, and stays on app_settings.rewards_config.cap.

create table if not exists public.reward_rules (
  strategy text not null check (strategy in ('conservative', 'aggressive', 'dominant')),
  class text not null check (class in ('standard', 'premium', 'influencer', 'aura')),
  action text not null check (action in ('standing', 'mesita_review', 'story', 'welcome', 'review')),
  -- 5% grid, floor 5, ceiling 70 (MESITA-866/872); 0 = off.
  discount_percent int not null default 0
    check (discount_percent = 0 or (discount_percent between 5 and 70 and discount_percent % 5 = 0)),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (strategy, class, action)
);

comment on table public.reward_rules is
  'Rewards v8 (MESITA-873): one row per (strategy × class × action) — the operator payout table the bill engine reads. "standing" is the None column. Zero strategy has no rows: it is off by definition. Cap lives on app_settings.rewards_config.cap.';

-- Clients never read this: pricing is resolved server-side and only the
-- blended final percent ever reaches a guest.
alter table public.reward_rules enable row level security;

-- Seed from the LIVE blob, not from defaults, so cutover moves no money.
-- Missing cells land at 0, exactly as coerceRewardsGrid would read them.
insert into public.reward_rules (strategy, class, action, discount_percent)
select
  s.strategy,
  c.class,
  a.action,
  coalesce(
    case
      when a.action = 'standing'
        then (rc.cfg -> 'grid' -> c.class ->> s.strategy)
      else coalesce(
        rc.cfg -> 'actions' -> a.action -> c.class ->> s.strategy,
        -- v12 fallback: the action's flat row lived inside `grid`.
        rc.cfg -> 'grid' -> a.action ->> s.strategy
      )
    end::numeric,
    0
  )::int
from (values ('conservative'), ('aggressive'), ('dominant')) as s(strategy)
cross join (values ('standard'), ('premium'), ('influencer'), ('aura')) as c(class)
cross join (values ('standing'), ('mesita_review'), ('story'), ('welcome'), ('review')) as a(action)
cross join (select rewards_config as cfg from public.app_settings where id = 1) as rc
on conflict (strategy, class, action) do nothing;
