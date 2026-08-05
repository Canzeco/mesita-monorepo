-- Harden Admin Reset: keep-list becomes DATA, not a copy-paste constant.
--
-- Root cause of the reward_rules wipe (and every earlier keep-list miss):
-- seed/patch migrations re-declare admin_reset_database() wholesale and
-- quietly drop a preserved table from the inlined array. Admin configs
-- (app_settings Atlas/Enricher/Memo/Sourcing/Reservations/Rewards/…) must
-- NEVER be truncatable by that footgun.
--
-- Fix: public.admin_reset_preserve holds the survival list. The reset
-- function READS it at run time. Adding a survivor is an INSERT. Future
-- CREATE OR REPLACE of admin_reset_database that forgets an array entry
-- can no longer delete app_settings / reward_rules / … — those rows live
-- outside the function body.
--
-- Required rows are also asserted before any truncate, so an emptied
-- preserve table aborts rather than wiping the singleton blind.

-- ─── 1. Preserve registry ───────────────────────────────────────────────
create table if not exists public.admin_reset_preserve (
  table_name text primary key
    check (table_name ~ '^[a-z][a-z0-9_]*$'),
  reason text not null
);

comment on table public.admin_reset_preserve is
  'Admin Reset survival list. Every public base table NOT named here is truncated by admin_reset_database(). Config/vocabulary only — never operational data. The reset function reads this at run time so CREATE OR REPLACE cannot drop survivors.';

alter table public.admin_reset_preserve enable row level security;

revoke all on table public.admin_reset_preserve from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_reset_preserve to service_role;

insert into public.admin_reset_preserve (table_name, reason) values
  ('admin_reset_preserve', 'the survival list itself — wiping it would make the next reset unbound'),
  ('app_settings',         'admin config singleton (Atlas / Enricher / Memo / Sourcing / Scoring / Reservations / Rewards cap / Models / Agents / Verification)'),
  ('super_admins',         'allowlist that gates this reset and every admin-web EF'),
  ('classes',              'consumer class vocabulary — re-seeded to canonical rows on reset'),
  ('business_plans',       'business plan vocabulary — re-seeded to canonical rows on reset'),
  ('place_categories',     'category vocabulary — re-seeded on reset'),
  ('place_tags',           'tag vocabulary — re-seeded on reset'),
  ('consumer_code_counter','1-row sequence holder — next_value reset to 0'),
  ('reward_rules',         'Rewards v8 operator payout table (strategy × class × action)')
on conflict (table_name) do update set reason = excluded.reason;

-- ─── 2. Reset reads the registry ────────────────────────────────────────
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

  -- Always keep the registry even if its own row was deleted.
  if not ('admin_reset_preserve' = any (keep_tables)) then
    keep_tables := keep_tables || array['admin_reset_preserve'];
  end if;

  -- Hard abort if the config/admin core is missing from the registry —
  -- better a loud failure than a silent wipe of Atlas/Memo/Rewards/…
  select array_agg(r order by r) into missing_required
    from unnest(array[
      'app_settings',
      'super_admins',
      'classes',
      'business_plans',
      'place_categories',
      'place_tags',
      'consumer_code_counter',
      'reward_rules'
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
    'preserved_tables', coalesce(array_length(keep_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

-- ─── 3. Prove registry covers itself + required config ──────────────────
do $verify$
declare
  keep_tables text[];
  would_wipe text[];
begin
  select coalesce(array_agg(p.table_name order by p.table_name), '{}'::text[])
    into keep_tables
    from public.admin_reset_preserve p;

  if not (
    keep_tables @> array[
      'admin_reset_preserve', 'app_settings', 'super_admins', 'classes',
      'business_plans', 'place_categories', 'place_tags',
      'consumer_code_counter', 'reward_rules'
    ]::text[]
  ) then
    raise exception 'admin_reset_preserve incomplete: %', keep_tables;
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

  if would_wipe && keep_tables then
    raise exception 'admin_reset_database would truncate a preserved table';
  end if;

  if 'app_settings' = any (would_wipe) or 'reward_rules' = any (would_wipe) then
    raise exception 'admin configs would still be wiped: %', would_wipe;
  end if;
end
$verify$;

notify pgrst, 'reload schema';
