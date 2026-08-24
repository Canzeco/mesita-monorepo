-- Schema invariants — asserted against a database built from EVERY migration.
--
-- Migrations already carry DO-block assertions (the 5A posture Pato picked in
-- /plan-eng-review 2026-08-09). Those verify the world at the moment the
-- migration runs and are blind to the failure that actually happened: a LATER
-- migration silently undoing them. 20260712040000 dropped security_invoker off
-- the projects_view rebuild and nobody noticed until an audit, because the
-- migration that asserted the invariant had already passed months earlier.
--
-- This file runs AFTER the last migration, so it sees the final schema — the
-- one that gets deployed. It is the only place in the repo where that is true.
--
-- Rules of the house:
--   * assert the LIVE name. `projects_view` became `public.profiles` in
--     20260818092000_rename_entities; a test pinned to a dead name passes
--     vacuously forever.
--   * derive sets in code where a set is the claim (the survivor registry
--     below reads pg_class rather than trusting a hand-listed table name).
--   * every assertion names the consequence, not the mechanism — the message
--     is what a future agent reads at 3am off a red check.

begin;

create extension if not exists pgtap with schema public;

select plan(28);

-- ━━━ public.profiles — the join every audience reads ━━━━━━━━━━━━━━━━━━━━━━━

select has_view(
  'public', 'profiles',
  'public.profiles exists (projects ⋈ places; every client read lands here)'
);

-- MESITA-599. A SECURITY DEFINER view runs RLS as its owner (postgres), so
-- losing this reloption hands anon every row of every place, listed or not.
select ok(
  exists (
    select 1 from pg_class
     where oid = 'public.profiles'::regclass
       and 'security_invoker=true' = any (reloptions)
  ),
  'public.profiles keeps security_invoker = true (without it anon reads rows RLS should hide)'
);

-- DROP VIEW discards grants. Every rebuild has to re-grant, and one that
-- forgets 401s consumer browse in production while CI stays green.
select ok(
  has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon keeps SELECT on public.profiles (consumer browse 401s without it)'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  'authenticated keeps SELECT on public.profiles'
);

select ok(
  has_table_privilege('service_role', 'public.profiles', 'SELECT'),
  'service_role keeps SELECT on public.profiles (every EF reads through it)'
);

-- The INSTEAD OF pair is what makes the view writable. A rebuild that drops
-- the view takes its triggers with it; the functions survive, so the loss is
-- invisible until a write silently affects zero rows.
select ok(
  exists (
    select 1 from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and not tgisinternal
       and tgname = 'profiles_insert_trg'
  ),
  'profiles_insert_trg is still bound (writes through the view are no-ops without it)'
);

select ok(
  exists (
    select 1 from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and not tgisinternal
       and tgname = 'profiles_update_trg'
  ),
  'profiles_update_trg is still bound (writes through the view are no-ops without it)'
);

-- ━━━ places.name — GENERATED, not a convention ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select attgenerated from pg_attribute
    where attrelid = 'public.places'::regclass and attname = 'name') = 's',
  'places.name is a STORED GENERATED column (a plain column lets writers diverge again)'
);

select col_not_null(
  'public', 'places', 'name',
  'places.name is NOT NULL (every place resolves a label)'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.places'::regclass
       and conname = 'places_name_source_present'
  ),
  'places_name_source_present survives (names the failure as a data problem)'
);

-- Behaviour, not just catalog shape: the resolution order is the product law.
savepoint before_name_probe;

insert into public.places (id, google_name)
values ('00000000-0000-4000-8000-0000000f0f0f', '  Tacos Martin  ');

select is(
  (select name from public.places where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Tacos Martin'::text,
  'no override ⇒ places.name follows google_name, trimmed'
);

update public.places set mesita_name = 'Los Tacos Martin'
 where id = '00000000-0000-4000-8000-0000000f0f0f';

select is(
  (select name from public.places where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Los Tacos Martin'::text,
  'mesita_name overrides google_name'
);

update public.places set mesita_name = '   '
 where id = '00000000-0000-4000-8000-0000000f0f0f';

select is(
  (select name from public.places where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Tacos Martin'::text,
  'a whitespace-only override is not an override'
);

-- 428C9 = ERRCODE_GENERATED_ALWAYS. Pinned, because "it threw something" would
-- also pass if the column had merely gone away.
select throws_ok(
  $$update public.places set name = 'direct write'
     where id = '00000000-0000-4000-8000-0000000f0f0f'$$,
  '428C9'::char(5), null::text,
  'places.name rejects a direct write'
);

-- Deliberately unpinned: the row violates the NOT NULL and the named CHECK at
-- once and Postgres does not promise which it reports.
select throws_ok(
  $$update public.places set google_name = null, mesita_name = null
     where id = '00000000-0000-4000-8000-0000000f0f0f'$$,
  null::char(5), null::text,
  'a place with neither mesita_name nor google_name is rejected'
);

rollback to savepoint before_name_probe;

-- ━━━ Wave 0 — project secrets stay off the publishable key ━━━━━━━━━━━━━━━━━

select ok(
  not has_table_privilege('anon', 'public.projects', 'SELECT'),
  'anon has no table-level SELECT on public.projects (table SELECT implies every column, including PIN)'
);

select ok(
  not has_table_privilege('authenticated', 'public.projects', 'SELECT'),
  'authenticated has no table-level SELECT on public.projects'
);

select ok(
  has_table_privilege('service_role', 'public.projects', 'SELECT'),
  'service_role keeps table SELECT on public.projects (Check + set-check-pin)'
);

select is_empty(
  $$select c from unnest(array[
      'check_pin', 'staff_pin', 'cfdi_rfc', 'cfdi_cp', 'cfdi_razon_social'
    ]) c
    where exists (
      select 1 from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = 'projects'
        and col.column_name = c
    )
      and (
        has_column_privilege('anon', 'public.projects', c, 'SELECT')
        or has_column_privilege('authenticated', 'public.projects', c, 'SELECT')
      )$$,
  'anon and authenticated have no SELECT on existing PIN / CFDI columns'
);

select ok(
  has_column_privilege('anon', 'public.projects', 'plan', 'SELECT'),
  'anon keeps SELECT on projects.plan (profiles invoker reads it)'
);

select ok(
  has_table_privilege('anon', 'public.places', 'SELECT'),
  'anon keeps table SELECT on public.places (Approach D is unimplementable)'
);

select ok(
  not has_table_privilege('anon', 'public.consumer_plans', 'SELECT'),
  'anon has no leftover SELECT on public.consumer_plans'
);

select ok(
  not has_table_privilege('anon', 'public.consumers', 'SELECT'),
  'anon has no leftover SELECT on public.consumers'
);

select ok(
  has_table_privilege('authenticated', 'public.consumers', 'SELECT'),
  'authenticated keeps SELECT on public.consumers (self policy id = auth.uid())'
);

select is_empty(
  $$select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'profiles_delete'$$,
  'profiles_delete is gone (no DELETE trigger; it hard-deleted both rows)'
);

-- ━━━ admin_reset_database — the survivor registry ━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'admin_reset_database'
       and p.prosecdef
  ),
  'admin_reset_database exists and is SECURITY DEFINER'
);

-- The function refuses to wipe unless every one of these is registered. The
-- list is duplicated there in PL/pgSQL, so a migration that seeds one and
-- forgets the other turns Reset into a hard error at the worst moment.
select is_empty(
  $$select r from unnest(array[
      'app_config', 'super_admins', 'classes', 'consumer_plans',
      'project_plans', 'place_categories', 'place_tags',
      'consumer_code_counter'
    ]) r
    where not exists (
      select 1 from public.admin_reset_preserve p where p.table_name = r
    )$$,
  'every survivor admin_reset_database requires is registered in admin_reset_preserve'
);

-- The other direction, derived rather than listed: a registry row naming a
-- table that no longer exists is a rename that only got done on one side, and
-- the renamed table is now in the WIPE set.
select is_empty(
  $$select p.table_name
      from public.admin_reset_preserve p
     where not exists (
       select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = p.table_name
          and c.relkind in ('r', 'p')
     )$$,
  'every admin_reset_preserve row names a live public table (a stale row means the real table gets wiped)'
);

select * from finish();

rollback;
