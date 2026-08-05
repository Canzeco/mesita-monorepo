-- Post-reset sanitization: reward_rules was wiped.
--
-- 20260804170740 (admin_reset_keep_reward_rules) put public.reward_rules on
-- the keep-list — operator payout config must survive a wipe, same as
-- classes / business_plans / place_* vocabulary.
--
-- 20260805195617 (influencer_follower_threshold_2000) re-declared
-- admin_reset_database() to bump the Influencer seed to 2,000 followers and
-- DROPPED reward_rules from keep_tables. The next Admin Reset truncated the
-- table to zero rows. Ticket pricing still worked via the legacy
-- app_settings.rewards_config blob fallback in loadRewardsGrid, but the v8
-- source of truth (and the admin Rewards Config page) was empty.
--
-- Fix: put reward_rules back on the keep-list, and re-seed the live empty
-- table from the surviving blob (same cutover SQL as 20260804170553).

-- ─── 1. Re-seed wiped rows from the preserved blob ──────────────────────
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
on conflict (strategy, class, action) do update set
  discount_percent = excluded.discount_percent,
  updated_at = now();

-- ─── 2. Restore keep-list (carry influencer seed = 2000) ────────────────
create or replace function public.admin_reset_database()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  -- The ONLY tables a reset keeps. Everything else in `public` is
  -- operational data and goes, discovered live. Adding a table here is a
  -- deliberate "this survives a wipe" decision:
  --   app_settings           config singleton (Atlas/Enricher/Memo/…)
  --   super_admins           the allowlist that gates this very function
  --   classes                consumer tier vocabulary — re-seeded below
  --   business_plans         business plan vocabulary — re-seeded below
  --   place_categories       category vocabulary — re-seeded below
  --   place_tags             tag vocabulary — re-seeded below
  --   consumer_code_counter  1-row sequence holder — reset to 0 below
  --   reward_rules           Rewards v8 operator payout table (MESITA-873)
  keep_tables constant text[] := array[
    'app_settings',
    'super_admins',
    'classes',
    'business_plans',
    'place_categories',
    'place_tags',
    'consumer_code_counter',
    'reward_rules'
  ];
  wipe_tables text[];
  deleted_users bigint;
begin
  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
  values
    ('standard', 'Standard', 0, null, 2,    0,     'MXN', 1.0),
    ('premium',  'Premium',  1, null, 10,   10000, 'MXN', 1.5),
    ('influencer', 'Influencer', 2, 2000, 10, 0,   'MXN', 1.5),
    ('aura',       'Aura',       3, null, 10, 0,   'MXN', 1.5)
  on conflict (key) do update set
    label                     = excluded.label,
    rank                      = excluded.rank,
    follower_threshold        = excluded.follower_threshold,
    monthly_reservation_limit = excluded.monthly_reservation_limit,
    price_cents               = excluded.price_cents,
    currency                  = excluded.currency,
    recommendation_weight     = excluded.recommendation_weight;

  insert into public.business_plans (key, label, price_cents, currency) values
    ('pro',   'Verified', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label       = excluded.label,
    price_cents = excluded.price_cents,
    currency    = excluded.currency;

  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

-- Prove keep-list still names real tables and reward_rules is no longer wiped.
do $verify$
declare
  keep_tables constant text[] := array[
    'app_settings', 'super_admins', 'classes', 'business_plans',
    'place_categories', 'place_tags', 'consumer_code_counter', 'reward_rules'
  ];
  missing text[];
  would_wipe text[];
begin
  select array_agg(k order by k) into missing
    from unnest(keep_tables) k
   where to_regclass('public.' || quote_ident(k)) is null;
  if missing is not null then
    raise exception 'admin_reset_database keep-list names table(s) that do not exist: %', missing;
  end if;

  select array_agg(c.relname order by c.relname) into would_wipe
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if 'reward_rules' = any (would_wipe) then
    raise exception 'admin_reset_database would still wipe reward_rules';
  end if;

  if would_wipe && keep_tables then
    raise exception 'admin_reset_database would truncate a preserved table';
  end if;
end
$verify$;

notify pgrst, 'reload schema';
