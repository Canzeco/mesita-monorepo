-- admin_reset_database: reseed Classes v2 metals, not v1 keys (MESITA-1305).
--
-- MESITA-1076 (`20260825003000`) renamed classes to bronze/silver/gold/diamond
-- and dropped recommendation_weight. This function was last rewritten in
-- 20260822043835, so a Reset still INSERTs the dropped column and four retired
-- keys. Postgres aborts (`column "recommendation_weight" does not exist`), the
-- wipe rolls back, the button looks dead.
--
-- Same body as 20260822043835 except:
--   * class seed is bronze 0 / silver 1 / gold 2 / diamond 3
--   * recommendation_weight is gone
--   * leftover non-metal class rows are deleted (consumers already truncated)
--   * project_plans.pro label is Partner (MESITA-1076), not Verified
-- Thresholds stay INSERT-only (MESITA-1179 / MESITA-1125).

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

  -- super_admins is the allowlist the LAST step deletes auth.users against, so
  -- an empty one does not mean "keep nobody extra", it means keep NOBODY: every
  -- auth user goes, the operator's included, and no Edge Function can re-grant
  -- admin afterwards because granting itself runs through checkSuperAdmin. That
  -- is unrecoverable from inside the product, so refuse here — beside the
  -- survivor check, before the first truncate, never half-way through the wipe.
  if not exists (select 1 from public.super_admins) then
    raise exception
      'super_admins is empty: the wipe would delete every auth user, including yours, and leave nobody able to re-grant admin. Refusing to wipe.';
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
  -- index mid-statement. Park every row outside the target range first —
  -- r -> -1-r is injective and lands in the negatives — so the upsert below
  -- can write 0..3 in any order.
  update public.classes set rank = -1 - rank where rank >= 0;

  -- TUNED COLUMNS ARE INSERT-ONLY (MESITA-1179). classes is preserved, so the
  -- upsert always meets live rows; force-writing a threshold or a limit
  -- reverts whatever shipped since these literals were last edited. They are
  -- written on INSERT only. Fresh-install ladder (MESITA-1125): Bronze none,
  -- Silver 1,000, Gold 5,000, Diamond 20,000.
  --
  -- `label` and `rank` keep converging. The metals are the vocabulary; rank
  -- must be rewritten past UNIQUE. A later re-rank MUST restamp these
  -- literals in the same migration.
  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit)
  values
    ('bronze',  'Bronze',  0,  null,  2),
    ('silver',  'Silver',  1,  1000, 10),
    ('gold',    'Gold',    2,  5000, 10),
    ('diamond', 'Diamond', 3, 20000, 10)
  on conflict (key) do update set
    label = excluded.label,
    rank  = excluded.rank;

  -- Operational tables are already empty, so leftover class keys have no
  -- remaining FKs. Drop them rather than parking them above the ladder.
  delete from public.classes
   where key not in ('bronze', 'silver', 'gold', 'diamond');

  -- Premium is MX$50. price_cents / currency / stripe_price_id are INSERT-only.
  insert into public.consumer_plans (key, label, price_cents, currency) values
    ('free',    'Free',       0, 'MXN'),
    ('premium', 'Premium', 5000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  insert into public.project_plans (key, label, price_cents, currency) values
    ('pro',   'Partner', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

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
