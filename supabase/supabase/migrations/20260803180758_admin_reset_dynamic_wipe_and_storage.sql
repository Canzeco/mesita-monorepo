-- Reset DB — make the wipe complete, and keep it complete.
--
-- Two defects, one root cause: the reset enumerated what to delete by hand,
-- so it only ever deleted what somebody remembered to add.
--
-- 1) STALENESS TREADMILL. Every table added since 0016 needed a follow-up
--    migration to join the truncate list, and every table dropped needed one
--    to leave it (20260727110000 after playground_reservations vanished,
--    20260803050000 after the four waiter tables did). Miss the follow-up and
--    the reset either leaves live rows behind (silent) or aborts with
--    "relation does not exist" (loud). Root CLAUDE.md even carries the chore
--    as a standing rule: "After architectural changes, update
--    admin_reset_database." That rule is the bug.
--
--    Fixed by inverting the list: the function now discovers every base table
--    in `public` at run time and truncates all of them EXCEPT an explicit
--    keep-list of config/vocabulary tables. A new table is wiped the day it
--    exists; a dropped table can never be named. Extension-owned tables are
--    skipped (they are not ours to truncate).
--
-- 2) ORPHANED STORAGE. place_media_assets has been truncated since
--    20260626120000, but the objects those rows pointed at were never
--    removed: 3,250 files were sitting in `place-images` on the live
--    singleton when this migration was written, against 22 surviving rows.
--    Every reset stranded another gallery's worth. The EF header claimed
--    "there is no bucket left to clear" — there were three.
--
--    The purge itself belongs in the Edge Function, not here: deleting
--    storage.objects rows over SQL orphans the underlying S3 files instead of
--    freeing them (metadata gone, bytes billed forever). Only the Storage API
--    deletes both. So this migration adds admin_reset_storage_paths(), the
--    service-role-only lister the EF drains in batches, and drops the stale
--    'preserved_media_assets' flag from the reset's return value — the EF now
--    reports a real purged-object count instead.
--
-- Re-declared wholesale rather than text-patched (the usual house rule for
-- this function) because the body's shape is what changes. Diffed against the
-- live definition first; the re-seed block and the auth.users delete below are
-- carried over verbatim from it.

-- ─── 1. Storage lister for the EF's purge loop ──────────────────────────
-- Returns a bounded page of live object paths, cheapest-first (the EF deletes
-- what it gets and asks again, so no cursor is needed). service_role only:
-- storage.objects is not reachable over PostgREST, and this is the whole
-- back door, so it stays shut to anon/authenticated.
create or replace function public.admin_reset_storage_paths(
  p_limit integer default 200,
  p_keep_buckets text[] default '{}'
)
returns table (bucket_id text, name text)
language sql
security definer
set search_path to 'pg_catalog', 'storage', 'public'
as $function$
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id <> all (coalesce(p_keep_buckets, '{}'::text[]))
   order by o.bucket_id, o.name
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
$function$;

revoke execute on function public.admin_reset_storage_paths(integer, text[])
  from public, anon, authenticated;
grant execute on function public.admin_reset_storage_paths(integer, text[])
  to service_role;

-- ─── 2. The reset itself ────────────────────────────────────────────────
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
  keep_tables constant text[] := array[
    'app_settings',
    'super_admins',
    'classes',
    'business_plans',
    'place_categories',
    'place_tags',
    'consumer_code_counter'
  ];
  wipe_tables text[];
  deleted_users bigint;
begin
  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')      -- base + partitioned tables, never views
     and not c.relispartition          -- parents cascade to their partitions
     and c.relname <> all (keep_tables)
     -- Extension-owned tables (postgis, pg_cron, …) are not app data.
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
    ('influencer', 'Influencer', 2, 1000, 10, 0,   'MXN', 1.5),
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

  -- Storage is purged by the caller (admin-web-reset-database) over the
  -- Storage API — see the header. 'preserved_media_assets' is deliberately
  -- gone from this payload: it stopped being true when place_media_assets
  -- joined the truncate list.
  return jsonb_build_object(
    'ok', true,
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

-- ─── 3. Prove the discovery agrees with the hand list it replaces ───────
-- Guards a typo in keep_tables (which would wipe config) and confirms the
-- previously-enumerated operational tables are all still covered.
do $verify$
declare
  keep_tables constant text[] := array[
    'app_settings', 'super_admins', 'classes', 'business_plans',
    'place_categories', 'place_tags', 'consumer_code_counter'
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

  -- Every table the old hand-written list truncated must still be in scope.
  if not (would_wipe @> array[
    'accounts', 'account_invites', 'consumer_mcp_tokens',
    'consumer_pay_notifications', 'consumer_review_claims',
    'consumer_subscriptions', 'consumers', 'coupons', 'membership_strikes',
    'place_creation_attempts', 'place_enrichment_events', 'place_media_assets',
    'place_research', 'places', 'project_members', 'project_subscriptions',
    'project_verifications', 'projects', 'reservations', 'saved_places',
    'stripe_events', 'ticket_check_events', 'ticket_reviews', 'tickets'
  ]::text[]) then
    raise exception 'admin_reset_database discovery lost a table the old list truncated: %', would_wipe;
  end if;

  -- …and nothing preserved may have slipped into it.
  if would_wipe && keep_tables then
    raise exception 'admin_reset_database would truncate a preserved table';
  end if;
end
$verify$;

notify pgrst, 'reload schema';
