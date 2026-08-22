-- admin_reset_database: tuned columns become insert-only, and an empty
-- allowlist refuses the wipe (MESITA-1179, MESITA-1192).
--
-- Two changes, nothing else:
--
-- (A) The vocabulary reseed no longer overwrites tuned values. classes,
--     consumer_plans and project_plans are PRESERVED tables — they survive the
--     truncate — so the reseed's upsert always lands on live rows, and a
--     DO UPDATE on a tuned column is not a reseed, it is a rollback to whenever
--     these literals were last hand-edited. Measured on the 2026-08-21 reset:
--     influencer.follower_threshold went 1000 -> 2000, and aura.follower_threshold
--     was found already null against a shipped law of 20000 — both because the
--     literals here still tracked 20260805195617 while 20260817110000 had moved
--     them. Both were repaired by hand; without this change the next reset
--     re-breaks them. Thresholds, limits, weights, prices and currency are now
--     written on INSERT only, and the literals below are corrected to the
--     shipped ladder (MESITA-1125) so a fresh install seeds the right values.
--
-- (B) An empty super_admins refuses the wipe. The final step deletes every
--     auth.users row not in the allowlist, so an empty allowlist deletes ALL of
--     them including the operator's — and nothing can re-grant admin afterwards,
--     because granting runs through checkSuperAdmin.
--
-- Everything else is byte-identical to the previous body.

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
  -- index mid-statement (this is exactly how the pre-MESITA-972 ranks made
  -- every reset fail with 23505). Park every row outside the target range
  -- first — r -> -1-r is injective and lands in the negatives — so the
  -- upsert below can write 0..3 in any order.
  update public.classes set rank = -1 - rank where rank >= 0;

  -- Price and Stripe id no longer live here: a class is earned, a plan is paid.
  --
  -- TUNED COLUMNS ARE INSERT-ONLY (MESITA-1179). This table is preserved, so
  -- the upsert always meets live rows; force-writing a threshold, a limit or a
  -- weight reverts whatever shipped since these literals were last edited. They
  -- are written on INSERT only, and the values below are the correct
  -- fresh-install ladder (MESITA-1125) — not a description of the live table.
  --
  -- `label` and `rank` deliberately KEEP converging. label because the reset
  -- owns the vocabulary; rank because the parking update above exists precisely
  -- so ranks can be rewritten past the UNIQUE index, and because the un-park
  -- step below only re-seats rows still left in the negatives — make rank
  -- insert-only and all four canonical rows stay parked, then get re-ranked to
  -- 4..7. WARNING: rank is therefore still force-written, so when MESITA-1076
  -- re-ranks the ladder to seat Gold at 2, these literals MUST be restamped in
  -- the same migration or the next reset will push aura below gold.
  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, recommendation_weight)
  values
    ('standard',   'Standard',   0,  null,  2, 1.0),
    ('influencer', 'Influencer', 1,  1000, 10, 1.5),
    ('premium',    'Premium',    2,  null, 10, 1.5),
    ('aura',       'Aura',       3, 20000, 10, 1.5)
  on conflict (key) do update set
    label = excluded.label,
    rank  = excluded.rank;

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
  -- hardcoded 10000 here silently reverted the shipped price on every reset —
  -- which is the same failure the insert-only rule above now prevents in
  -- general: price_cents and currency join stripe_price_id as INSERT-only, so a
  -- repriced plan survives a reset and a fresh install still gets a real price.
  insert into public.consumer_plans (key, label, price_cents, currency) values
    ('free',    'Free',       0, 'MXN'),
    ('premium', 'Premium', 5000, 'MXN')
  on conflict (key) do update set
    label = excluded.label;

  insert into public.project_plans (key, label, price_cents, currency) values
    ('pro',   'Verified', 100000, 'MXN'),
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
