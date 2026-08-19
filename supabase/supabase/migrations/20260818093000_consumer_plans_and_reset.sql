-- A class is WHO YOU ARE: earned, public, ranked. A plan is WHAT YOU PAY:
-- private. `classes` was holding price_cents and a Stripe price id, which is
-- the plan wearing the class's clothes — the same confusion identityForClassKey
-- already bridges in code. Nothing reads those two columns (verified across all
-- 146 EFs and every app), so they were dead weight as well as wrong.

create table if not exists public.consumer_plans (
  key             text primary key,
  label           text not null,
  price_cents     integer not null default 0,
  currency        text not null default 'MXN',
  stripe_price_id text,
  created_at      timestamptz not null default now()
);

alter table public.consumer_plans enable row level security;

-- Catalog, same posture as project_plans: readable by the app, written by
-- migrations and the reset only.
grant select on public.consumer_plans to anon, authenticated;

insert into public.consumer_plans (key, label, price_cents, currency, stripe_price_id)
select 'free', 'Free', 0, 'MXN', null
where not exists (select 1 from public.consumer_plans where key = 'free');

-- Carry the live values across rather than hardcoding them: the price moved to
-- MX$50 two days ago and the Stripe id is environment-specific.
insert into public.consumer_plans (key, label, price_cents, currency, stripe_price_id)
select 'premium', 'Premium', c.price_cents, c.currency, c.stripe_price_id
  from public.classes c
 where c.key = 'premium'
   and not exists (select 1 from public.consumer_plans where key = 'premium');

alter table public.classes
  drop column if exists price_cents,
  drop column if exists currency,
  drop column if exists stripe_price_id;

-- ---- the reset's survivor list has to move with the renames.
-- admin_reset_database cross-checks a HARDCODED required list against the rows
-- in admin_reset_preserve, then truncates every public table not named there.
-- Renaming a survivor without updating BOTH sides means the reset truncates the
-- live config and the plan catalogs on its next run.
delete from public.admin_reset_preserve where table_name = 'reward_rules';

update public.admin_reset_preserve set table_name = 'app_config'   where table_name = 'app_settings';
update public.admin_reset_preserve set table_name = 'project_plans' where table_name = 'business_plans';

update public.admin_reset_preserve
   set reason = 'project plan vocabulary — re-seeded to canonical rows on reset'
 where table_name = 'project_plans';

insert into public.admin_reset_preserve (table_name, reason)
select 'consumer_plans', 'consumer plan vocabulary (free/premium) — re-seeded to canonical rows on reset'
where not exists (select 1 from public.admin_reset_preserve where table_name = 'consumer_plans');

create or replace function public.admin_reset_database()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables text[];
  wipe_tables text[];
  deleted_users bigint;
  missing_required text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_config',
      'super_admins',
      'classes',
      'consumer_plans',
      'project_plans',
      'place_categories',
      'place_tags',
      'consumer_code_counter'
    ]) r
   where not (r = any (keep_tables));
  if missing_required is not null then
    raise exception
      'admin_reset_preserve is missing required survivor(s): %. Refusing to wipe.',
      missing_required;
  end if;

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

  -- classes.rank is UNIQUE and the canonical ladder is written in ONE
  -- statement, so a reseed that moves two classes past each other trips the
  -- index mid-statement (this is exactly how the pre-MESITA-972 ranks made
  -- every reset fail with 23505). Park every row outside the target range
  -- first — r -> -1-r is injective and lands in the negatives — so the
  -- upsert below can write 0..3 in any order.
  update public.classes set rank = -1 - rank where rank >= 0;

  -- Price and Stripe id no longer live here: a class is earned, a plan is paid.
  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, recommendation_weight)
  values
    ('standard',   'Standard',   0, null, 2,  1.0),
    ('influencer', 'Influencer', 1, 2000, 10, 1.5),
    ('premium',    'Premium',    2, null, 10, 1.5),
    ('aura',       'Aura',       3, null, 10, 1.5)
  on conflict (key) do update set
    label                     = excluded.label,
    rank                      = excluded.rank,
    follower_threshold        = excluded.follower_threshold,
    monthly_reservation_limit = excluded.monthly_reservation_limit,
    recommendation_weight     = excluded.recommendation_weight;

  -- A class outside the canonical four stays parked in the negatives above.
  -- Rank it just above the ladder instead of leaving the table inverted.
  update public.classes c
     set rank = 3 + l.n
    from (
      select key, row_number() over (order by rank desc) as n
        from public.classes
       where rank < 0
    ) l
   where c.key = l.key;

  -- Premium is MX$50 (MESITA: "Premium is MX$50 and +10 again"). The old
  -- hardcoded 10000 here silently reverted the shipped price on every reset.
  -- stripe_price_id is deliberately NOT reseeded: it is environment-specific
  -- and coalesce keeps whatever the operator configured.
  insert into public.consumer_plans (key, label, price_cents, currency) values
    ('free',    'Free',       0, 'MXN'),
    ('premium', 'Premium', 5000, 'MXN')
  on conflict (key) do update set
    label       = excluded.label,
    price_cents = excluded.price_cents,
    currency    = excluded.currency;

  insert into public.project_plans (key, label, price_cents, currency) values
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
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;
