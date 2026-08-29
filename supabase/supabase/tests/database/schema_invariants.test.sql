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

select plan(68);

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
  $$select c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'projects'
       and c.column_name in (
         'check_pin', 'staff_pin', 'cfdi_rfc', 'cfdi_cp', 'cfdi_razon_social'
       )
       and (
         has_column_privilege('anon', 'public.projects', c.column_name, 'SELECT')
         or has_column_privilege(
           'authenticated', 'public.projects', c.column_name, 'SELECT'
         )
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

-- ━━━ Identity — metals + consumers.plan ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'consumers' and column_name = 'plan'
  ),
  'consumers.plan exists (class and plan are two axes)'
);

select has_column(
  'public', 'consumers', 'deleted_at',
  'consumers.deleted_at exists (deletion is a status; tickets stay)'
);

select ok(
  exists (
    select 1 from pg_policy
     where polrelid = 'public.consumers'::regclass
       and polname = 'consumers_select_self'
       and pg_get_expr(polqual, polrelid) ilike '%deleted_at%'
  ),
  'consumers_select_self hides tombstoned rows'
);

select is_empty(
  $$select key from public.classes
     where key not in ('bronze', 'silver', 'gold', 'diamond')$$,
  'classes holds only the four metals'
);

select is(
  (select rank from public.classes where key = 'bronze'),
  0::smallint,
  'bronze is rank 0'
);

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'classes'
       and column_name = 'recommendation_weight'$$,
  'classes.recommendation_weight is gone'
);

-- MESITA-1305: Reset must reseed the live metals. A CREATE OR REPLACE that
-- forgets the cutover writes a dropped column / retired keys and the button
-- aborts. Probe the live function text, not a fixture.
select ok(
  pg_get_functiondef('public.admin_reset_database()'::regprocedure)
    not like '%recommendation_weight%',
  'admin_reset_database does not write dropped classes.recommendation_weight'
);

select ok(
  pg_get_functiondef('public.admin_reset_database()'::regprocedure)
    like '%''bronze''%'
  and pg_get_functiondef('public.admin_reset_database()'::regprocedure)
    like '%''diamond''%'
  and pg_get_functiondef('public.admin_reset_database()'::regprocedure)
    not like '%''Influencer''%',
  'admin_reset_database reseeds metals, not v1 class keys'
);

select is(
  (select label from public.project_plans where key = 'pro'),
  'Partner'::text,
  'project_plans.pro is labelled Partner'
);

select is(
  (select column_default::text from information_schema.columns
    where table_schema = 'public' and table_name = 'consumers'
      and column_name = 'class_key'),
  '''bronze''::text'::text,
  'new consumers default to bronze'
);

select is_empty(
  $$select 1 from pg_constraint
     where conrelid = 'public.consumers'::regclass
       and pg_get_constraintdef(oid) ilike '%subscription%'$$,
  'class_origin no longer includes subscription'
);

-- ━━━ Attics — twins, dead tables, dead URLs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projects'
       and column_name in ('staff_pin', 'requires_story')$$,
  'projects.staff_pin and requires_story are gone'
);

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'visit_tickets'
       and column_name = 'ticket_code'$$,
  'visit_tickets.ticket_code is gone (check_code stays)'
);

select has_column(
  'public', 'projects', 'check_pin',
  'projects.check_pin stays (the twin staff_pin is what dropped)'
);

select has_column(
  'public', 'visit_tickets', 'check_code',
  'visit_tickets.check_code stays (the twin ticket_code is what dropped)'
);

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name in ('tiktok_url', 'tripadvisor_url', 'yelp_url')$$,
  'dead place URL columns are gone'
);

select ok(
  (
    select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in ('tiktok_url', 'tripadvisor_url', 'yelp_url', 'requires_story')
  ) = 4,
  'profiles still projects dummy leftover columns so pre-redeploy EFs can SELECT them'
);

select ok(
  to_regclass('public.guest_make_goods') is null,
  'guest_make_goods is gone'
);

select ok(
  to_regclass('public.refund_requests') is null,
  'refund_requests is gone'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'projects'
       and column_name = 'cfdi_rfc'
  ),
  'projects.cfdi_rfc is in the ledger (local replay matches live)'
);

-- ━━━ Honest keys — no project_id column left ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is_empty(
  $$select c.relname
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and a.attname = 'project_id'
       and a.attnum > 0 and not a.attisdropped
       and c.relkind in ('r', 'p')$$,
  'no public base table still has a project_id column'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'visit_tickets'
       and column_name = 'place_id'
  ),
  'visit_tickets.place_id exists'
);

select ok(
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_project_member'
  ),
  'is_project_member keeps its name (RPC JSON does not move)'
);

-- ━━━ Ghost names + HNSW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is_empty(
  $$select tgname from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'projects' and not tgisinternal
       and tgname = 'units_set_updated_at'$$,
  'units_set_updated_at is gone from projects'
);

select ok(
  exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'projects' and not tgisinternal
       and tgname = 'projects_set_updated_at'
  ),
  'projects_set_updated_at is bound'
);

select ok(
  exists (
    select 1 from pg_class
     where relname = 'places_embedding_hnsw' and relkind = 'i'
  ),
  'places_embedding_hnsw exists'
);

-- MESITA-1248: leftover atlas_* / memo_* scalars folded into jsonb.
select is(
  (select count(*)::bigint from information_schema.columns
    where table_schema = 'public' and table_name = 'app_config'
      and column_name ~ '^(atlas_|memo_)'
      and column_name <> 'memo_config'),
  0::bigint,
  'app_config has no leftover atlas_* / memo_* scalars (folded into enrichment_config / memo_config)'
);

select has_column(
  'public', 'app_config', 'enrichment_config',
  'app_config.enrichment_config holds the Intake knobs'
);

select has_column(
  'public', 'app_config', 'memo_config',
  'app_config.memo_config holds Memo greeting/instructions/legacy model keys'
);

select has_column(
  'public', 'places', 'request_count',
  'places.request_count is the numeric Requests progress'
);

select has_table(
  'public', 'place_requests',
  'place_requests stores one request per consumer per place'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.place_requests'::regclass),
  'place_requests has RLS enabled (EF-only; no client policies)'
);

select ok(
  not has_table_privilege('anon', 'public.place_requests', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_requests', 'SELECT'),
  'client roles have no SELECT on place_requests'
);

select has_function(
  'public', 'apply_place_request',
  array['uuid', 'uuid'],
  'apply_place_request is the idempotent request door'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'request_count'
  ),
  'public.profiles exposes request_count'
);

select has_table(
  'public', 'place_super_categories',
  'Atlas Super Category vocabulary exists'
);

select is(
  (select count(*)::bigint from public.place_super_categories),
  6::bigint,
  'Atlas Super Category catalog is six slugs (5–10 band)'
);

select is(
  (select super_category_slugs from public.place_categories where slug = 'breakfast'),
  array['restaurants', 'cafes_bakeries']::text[],
  'breakfast intersects restaurants and cafes'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'places'
       and column_name = 'family_keys'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'family_keys'
  ),
  'places.family_keys is stored and exposed on public.profiles'
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
      'project_plans', 'place_categories', 'place_super_categories',
      'place_tags', 'consumer_code_counter'
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

-- MESITA-709: n8n ×3, Serper, and TripAdvisor vault rows are gone. A re-seed
-- of those names is the finding — never print decrypted values.
select is_empty(
  $$select name from vault.secrets
     where name ~* '(n8n|serper|tripadvisor)'$$,
  'vault.secrets has no retired n8n / serper / tripadvisor rows'
);

select * from finish();

rollback;
