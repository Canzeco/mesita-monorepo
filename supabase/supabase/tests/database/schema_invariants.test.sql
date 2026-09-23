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

select plan(130);

-- ━━━ public.profiles — the join every audience reads ━━━━━━━━━━━━━━━━━━━━━━━

select has_view(
  'public', 'profiles',
  'public.profiles exists (places ⋈ place_profiles; every client read lands here)'
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

-- MESITA-1704: the three checks above passed for a full day while `profiles`
-- was 42501 for every guest. A privilege on a VIEW says the role may reach it;
-- a `security_invoker` view then re-checks the role against everything its
-- BODY touches, and nothing above can see the body. The column that did it was
-- a derived one reading a tenant table above the place — neither half of which
-- a client role held — and the consumer app answered "permission denied for
-- table places" in a red band over the Search map. That tenant layer is gone
-- (MESITA-1892) and `mesita_pay_enabled` is now a plain column of
-- `place_profiles`, but the lesson is about the NEXT derived column, not that
-- one, so the probe stays.
--
-- So: run the read. This is the only assertion in the file that proves the
-- guest browse works rather than that a privilege bit is set.
create or replace function pg_temp.client_role_reads_profiles(role_name text)
returns text language plpgsql as $probe$
declare verdict text;
begin
  begin
    execute format('set local role %I', role_name);
    perform id, mesita_pay_enabled from public.profiles limit 1;
    reset role;
    verdict := 'OK';
  exception when others then
    reset role;
    verdict := sqlstate || ' ' || sqlerrm;
  end;
  return verdict;
end $probe$;

select is(
  pg_temp.client_role_reads_profiles('anon'), 'OK',
  'anon can actually READ public.profiles (not just hold a privilege on it)'
);

select is(
  pg_temp.client_role_reads_profiles('authenticated'), 'OK',
  'authenticated can actually READ public.profiles'
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

-- ━━━ place_profiles.name — GENERATED, not a convention ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select attgenerated from pg_attribute
    where attrelid = 'public.place_profiles'::regclass and attname = 'name') = 's',
  'place_profiles.name is a STORED GENERATED column (a plain column lets writers diverge again)'
);

select col_not_null(
  'public', 'place_profiles', 'name',
  'place_profiles.name is NOT NULL (every place resolves a label)'
);

select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.place_profiles'::regclass
       and conname = 'place_profiles_name_source_present'
  ),
  'place_profiles_name_source_present survives (names the failure as a data problem)'
);

-- Behaviour, not just catalog shape: the resolution order is the product law.
savepoint before_name_probe;

insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-0000000f0f0f', '  Tacos Martin  ');

select is(
  (select name from public.place_profiles where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Tacos Martin'::text,
  'no override ⇒ place_profiles.name follows google_name, trimmed'
);

update public.place_profiles set mesita_name = 'Los Tacos Martin'
 where id = '00000000-0000-4000-8000-0000000f0f0f';

select is(
  (select name from public.place_profiles where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Los Tacos Martin'::text,
  'mesita_name overrides google_name'
);

update public.place_profiles set mesita_name = '   '
 where id = '00000000-0000-4000-8000-0000000f0f0f';

select is(
  (select name from public.place_profiles where id = '00000000-0000-4000-8000-0000000f0f0f'),
  'Tacos Martin'::text,
  'a whitespace-only override is not an override'
);

-- 428C9 = ERRCODE_GENERATED_ALWAYS. Pinned, because "it threw something" would
-- also pass if the column had merely gone away.
select throws_ok(
  $$update public.place_profiles set name = 'direct write'
     where id = '00000000-0000-4000-8000-0000000f0f0f'$$,
  '428C9'::char(5), null::text,
  'place_profiles.name rejects a direct write'
);

-- Deliberately unpinned: the row violates the NOT NULL and the named CHECK at
-- once and Postgres does not promise which it reports.
select throws_ok(
  $$update public.place_profiles set google_name = null, mesita_name = null
     where id = '00000000-0000-4000-8000-0000000f0f0f'$$,
  null::char(5), null::text,
  'a place with neither mesita_name nor google_name is rejected'
);

rollback to savepoint before_name_probe;

-- ━━━ Reservations is ONE fact, and the operator owns it ━━━━━━━━━━━━━━━━━━━━
--
-- MESITA-1737. `reservation_channel` is the operator's pick (the Capabilities
-- tab's ChannelPicker, "Not" included); `reservations_enabled` is what the
-- guest's Reserve CTA reads. They used to be able to disagree, because the
-- only writer of the bit was an LLM guess in the contents cron — so an
-- operator could answer "Not" and keep taking bookings.
--
-- Behaviour, not catalog shape: asserting the trigger EXISTS would pass on a
-- trigger whose body had been gutted, and this rule is only worth anything as
-- an outcome.

savepoint before_reservations_probe;

insert into public.place_profiles (id, google_name, reservations_enabled)
values ('00000000-0000-4000-8000-0000000f0f10', 'Cena Tardía', true);

select is(
  (select reservations_enabled from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000f0f10'),
  true,
  'no channel picked ⇒ the enricher''s seed stands (a place nobody has answered for)'
);

update public.place_profiles set reservation_channel = 'none'
 where id = '00000000-0000-4000-8000-0000000f0f10';

select is(
  (select reservations_enabled from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000f0f10'),
  false,
  'the operator answers "Not" ⇒ the Reserve CTA goes away, whatever the enricher guessed'
);

-- The regression that matters most: a contents re-run writes the bit and
-- leaves the channel alone. Before the trigger this silently reopened
-- bookings at a place that had said it takes none.
update public.place_profiles set reservations_enabled = true
 where id = '00000000-0000-4000-8000-0000000f0f10';

select is(
  (select reservations_enabled from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000f0f10'),
  false,
  'a re-enrichment cannot overwrite an answer the operator already gave'
);

update public.place_profiles set reservation_channel = 'phone'
 where id = '00000000-0000-4000-8000-0000000f0f10';

select is(
  (select reservations_enabled from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000f0f10'),
  true,
  'picking a real channel turns the CTA back on'
);

-- The trigger tests `reservation_channel is not null` and nothing else. That
-- is only sufficient while the column cannot hold a third kind of value — an
-- empty string in particular, which the console's `readChannel` produces for
-- anything it does not recognise and which must never read as "Not". The
-- CHECK is what makes NULL-vs-set a clean two-state question, so assert it
-- here rather than leaving the trigger resting on an assumption.
select throws_ok(
  $$update public.place_profiles set reservation_channel = ''
     where id = '00000000-0000-4000-8000-0000000f0f10'$$,
  '23514'::char(5), null::text,
  'an empty reservation_channel is refused by the schema (so "unanswered" can only be NULL)'
);

-- MESITA-1799: a newly discovered place nobody has answered for offers Reserve.
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-0000000f0f11', 'Default On');

select is(
  (select reservations_enabled from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000f0f11'),
  true,
  'a newly discovered place offers Reserve by default (MESITA-1799)'
);

rollback to savepoint before_reservations_probe;

-- ━━━ Wave 0 — place secrets stay off the publishable key ━━━━━━━━━━━━━━━━━━━

select ok(
  not has_table_privilege('anon', 'public.places', 'SELECT'),
  'anon has no table-level SELECT on public.places (table SELECT implies every column, including PIN)'
);

select ok(
  not has_table_privilege('authenticated', 'public.places', 'SELECT'),
  'authenticated has no table-level SELECT on public.places'
);

select ok(
  has_table_privilege('service_role', 'public.places', 'SELECT'),
  'service_role keeps table SELECT on public.places (Check + set-check-pin)'
);

select is_empty(
  $$select c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'places'
       and c.column_name in (
         -- MESITA-1892 moved the merchant's legal identity onto `places`
         -- from a table no client role could reach at all. `places` is
         -- column-granted, so the same secrecy now has to be stated as the
         -- ABSENCE of a grant — which is exactly what this slot checks.
         'check_pin', 'staff_pin', 'cfdi_rfc', 'cfdi_cp', 'cfdi_razon_social',
         'rfc', 'legal_name', 'stripe_billing_customer_id'
       )
       and (
         has_column_privilege('anon', 'public.places', c.column_name, 'SELECT')
         or has_column_privilege(
           'authenticated', 'public.places', c.column_name, 'SELECT'
         )
       )$$,
  'anon and authenticated have no SELECT on existing PIN / CFDI / legal-identity columns'
);

select ok(
  has_column_privilege('anon', 'public.places', 'plan', 'SELECT'),
  'anon keeps SELECT on places.plan (profiles invoker reads it)'
);

-- The set IS the claim, so it is derived, not typed: every `places` column the
-- `profiles` body references, read straight out of the view's rewrite rule. A
-- hand-listed column (`plan`, above) can only catch the loss of a column
-- someone already thought of; this catches the NEXT one added to the view,
-- which is how MESITA-1704 happened. Failing here names the column instead of
-- letting Postgres blame the whole table in production.
select is_empty(
  $$select a.attname
      from pg_depend d
      join pg_rewrite r
        on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
      join pg_attribute a
        on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
     where r.ev_class = 'public.profiles'::regclass
       and d.refobjid = 'public.places'::regclass
       and d.refobjsubid > 0
       and (
         not has_column_privilege('anon', 'public.places', a.attname, 'SELECT')
         or not has_column_privilege(
           'authenticated', 'public.places', a.attname, 'SELECT'
         )
       )$$,
  'every places column the profiles view reads is client-readable (a security_invoker view is only as readable as its body)'
);

-- The other half of MESITA-1704: the repair must never become "open the table".
-- The pay bit used to be ANDed with a tenant table's copy of it, reached
-- through a security-definer function because no client role could read that
-- table. MESITA-1892 folded that half into `place_profiles`, so nothing in the
-- view's body is EF-only any more — but the tables that replaced the tenant
-- layer still are, and a future column appended to `profiles` must never be
-- answered by reaching into one of them.
select ok(
  not has_table_privilege('anon', 'public.place_payment_accounts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.place_payment_accounts', 'SELECT')
  and not has_table_privilege('anon', 'public.place_guest_customers', 'SELECT')
  and not has_table_privilege('authenticated', 'public.place_guest_customers', 'SELECT'),
  'the place-scoped tenant tables stay closed to the client roles (nothing on public.profiles may read one)'
);

select ok(
  has_table_privilege('anon', 'public.place_profiles', 'SELECT'),
  'anon keeps table SELECT on public.place_profiles (Approach D is unimplementable)'
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
  'consumers.deleted_at exists (deletion is a state; tickets stay)'
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

-- MESITA-2044: Diamond is invitation-only. A follower_threshold on
-- any row would name a class the (self-declared) Instagram count can open;
-- class-doors.ts no longer reads it, and this keeps the data honest too.
select is_empty(
  $$select key from public.classes where follower_threshold is not null$$,
  'no class opens from followers (Diamond is invitation-only)'
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
  (select label from public.place_plans where key = 'pro'),
  'Partner'::text,
  'place_plans.pro is labelled Partner'
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
     where table_schema = 'public' and table_name = 'places'
       and column_name in ('staff_pin', 'requires_story')$$,
  'places.staff_pin and requires_story are gone'
);

select is_empty(
  $$select c.relname
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and a.attname = 'ticket_code'
       and a.attnum > 0 and not a.attisdropped
       and c.relkind in ('r', 'p', 'v', 'm', 'f')$$,
  'no public relation still has a ticket_code column (check_code stays) — schema-wide, matching its project_id twin from the same cutover'
);

select has_column(
  'public', 'places', 'check_pin',
  'places.check_pin stays (the twin staff_pin is what dropped)'
);

select has_column(
  'public', 'visit_tickets', 'check_code',
  'visit_tickets.check_code stays (the twin ticket_code is what dropped)'
);

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'place_profiles'
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

-- MESITA-1722 inverted this assertion in place, so the plan count is unchanged.
-- It used to assert places.cfdi_rfc EXISTS: the column was created cloud-side
-- by the pre-monorepo standalone repo, and 20260825001000 back-filled it into
-- the ledger so local replay would stop 42703-ing the Wave 0 pins. Its only
-- writer was the ghost EF business-web-update-cfdi, which had no repo source
-- and had already stopped working when MESITA-1590 renamed `projects`. All
-- three CFDI columns are dropped now, so the same slot guards the drop instead
-- of the back-fill.
select is_empty(
  $$select c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'places'
       and c.column_name in ('cfdi_rfc', 'cfdi_razon_social', 'cfdi_cp')$$,
  'the three CFDI columns are gone from places'
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
       and c.relkind in ('r', 'p', 'v', 'm', 'f')$$,
  'no public relation still has a project_id column (views and matviews included: the 20260825 rename only touched base tables, so a view is where it would come back)'
);

-- MESITA-1720. The catalogue pins above (project_id here, ticket_code in
-- Attics) cannot see a function body. ALTER RENAME does not rewrite
-- PL/pgSQL or LANGUAGE sql, which is how 20260906000000 shipped
-- jsonb_build_object('project_id', v_row.place_id) inside
-- run_place_enrichment_stages — live until a later migration fixed it by
-- hand. Scan prosrc (the body), never pg_get_functiondef: the definer text
-- includes the signature, and two functions deliberately keep the argument
-- name p_project_id (42P13 refuses to rename it without DROP, which would
-- cascade onto storage RLS). \y is a word boundary and _ is a word char, so
-- p_project_id does not match; a body that still names the retired COLUMN
-- is never excused.
select is_empty(
  $$select n.nspname || '.' || p.proname
         || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosrc ~* '\y(project_id|ticket_code)\y'$$,
  'no public function body names retired columns project_id or ticket_code (ALTER RENAME does not rewrite plpgsql; this is how the enrichment dispatcher shipped a dead wire key)'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'visit_tickets'
       and column_name = 'place_id'
  ),
  'visit_tickets.place_id exists'
);

-- Superseded by MESITA-1590: this pinned is_project_member's NAME staying
-- put across the 20260825005000 project_id->place_id COLUMN rename, since
-- nothing in that migration's scope touched the entity itself. MESITA-1590
-- renames the entity (projects->places) and took this function's name with
-- it — verified no client calls it by name (grep across every app found only
-- generated database.types.ts, never a hand-written .rpc('is_project_member')
-- call site) — so the "RPC JSON does not move" guarantee had no live caller
-- depending on it. Pin the new name instead of deleting the assertion.
select ok(
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_place_member'
  ),
  'is_place_member exists (renamed from is_project_member, MESITA-1590)'
);

-- ━━━ Ghost names + HNSW ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is_empty(
  $$select tgname from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'places' and not tgisinternal
       and tgname = 'units_set_updated_at'$$,
  'units_set_updated_at is gone from places'
);

select ok(
  exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where c.relname = 'places' and not tgisinternal
       and tgname = 'places_set_updated_at'
  ),
  'places_set_updated_at is bound'
);

select ok(
  exists (
    select 1 from pg_class
     where relname = 'place_profiles_embedding_hnsw' and relkind = 'i'
  ),
  'place_profiles_embedding_hnsw exists'
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
  'app_config.enrichment_config holds the Crenup knobs'
);

select has_column(
  'public', 'app_config', 'memo_config',
  'app_config.memo_config holds Memo greeting/instructions/legacy model keys'
);

-- ━━━ app_config.controls_config — the Wallet's Credits terms ━━━━━━━━━━━━━━━

select has_column(
  'public', 'app_config', 'controls_config',
  'app_config.controls_config holds the Wallet Credits terms'
);

-- Every key the EFs normalize against. A migration that rewrites this blob and
-- drops one hands every place a default nobody chose, silently, because
-- normalizeControlsConfig is deliberately tolerant of a missing key.
select is_empty(
  $$select k from unnest(array[
      'defaultHoldHours', 'defaultBonusPct', 'maxHoldHours', 'minHoldHours',
      'defaultExpiryDays', 'minExpiryDays'
    ]) k
    where not exists (
      select 1 from public.app_config c
       where c.id = 1 and c.controls_config ? k
    )$$,
  'controls_config carries every key the Controls page and the EFs read'
);

-- EXPIRY IS IN DAYS, THE HOLD IS IN HOURS. The two knobs sit in one blob
-- wearing different units, so the failure this pins is an expiry written in the
-- hold's unit: 2160 for a quarter reads as a six-year life and nothing else
-- would notice. Ten years is the outer bound on any real term.
select ok(
  (select (controls_config->>'defaultExpiryDays')::numeric <= 3650
      and (controls_config->>'minExpiryDays')::numeric <= 3650
     from public.app_config where id = 1),
  'controls_config expiry is a DAY count, not the hold''s hours smuggled across'
);

-- The one combination of these numbers that sells a guest money they can never
-- spend: a life shorter than the longest hold a place may set. The EF clamps it
-- on write; this catches a migration writing the blob directly.
select ok(
  (select (controls_config->>'minExpiryDays')::numeric * 24
        >= (controls_config->>'maxHoldHours')::numeric
     from public.app_config where id = 1),
  'controls_config can never expire Credits before they mature'
);

select has_column(
  'public', 'place_profiles', 'request_count',
  'place_profiles.request_count is the numeric Requests progress'
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
  'public', 'place_families',
  'place family vocabulary exists'
);

select is(
  (select count(*)::bigint from public.place_families),
  8::bigint,
  'place family catalog is eight slugs: seven real + Other'
);

select is(
  (select label from public.place_families where slug = 'undefined'),
  'Undefined',
  'the leftover family is labelled Undefined'
);

select is(
  (select array_agg(slug order by sort_order) from public.place_families),
  array['restaurants','cafes_bakeries','bars_nightlife','experiences',
        'culture_arts','sports_fitness','wellness_beauty','undefined']::text[],
  'family catalog order matches the law; Other last'
);

select is(
  (select family_keys from public.place_categories where slug = 'breakfast'),
  array['restaurants','cafes_bakeries']::text[],
  'breakfast is a double: restaurants AND cafés'
);

select is(
  (select family_keys from public.place_categories where slug = 'karaoke'),
  array['bars_nightlife','experiences']::text[],
  'karaoke is a double: bars AND experiences'
);

select is(
  (select count(*)::bigint from public.place_categories
    where cardinality(family_keys) = 2),
  7::bigint,
  'exactly seven double-parent categories'
);

select is(
  (select count(*)::bigint from public.place_categories
    where 'sports_fitness' = any(family_keys)),
  12::bigint,
  'Sports & Fitness holds twelve categories'
);

select is(
  (select count(*)::bigint from public.place_categories
    where 'wellness_beauty' = any(family_keys)),
  12::bigint,
  'Wellness & Beauty holds twelve categories'
);

select is(
  (select family_keys from public.place_categories where slug = 'undefined'),
  array['undefined']::text[],
  'undefined category belongs to family undefined'
);

select is(
  (select min(cardinality(family_keys))::bigint from public.place_categories),
  1::bigint,
  'every Atlas category maps to at least one family'
);

select is(
  (select max(cardinality(family_keys))::bigint from public.place_categories),
  2::bigint,
  'every Atlas category maps to at most two families'
);

select is_empty(
  $$select p.id from public.place_profiles p
     where p.family_keys is not null
       and exists (
         select 1 from unnest(p.family_keys) k
          where k not in (select slug from public.place_families)
       )$$,
  'no place carries an orphan family key'
);

select ok(
  exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'place_profiles'
       and column_name = 'family_keys'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'family_keys'
  ),
  'place_profiles.family_keys is stored and exposed on public.profiles'
);

-- ━━━ MESITA-1857 — the rename, proved by CALLING, not by looking ━━━━━━━━━━━
--
-- `atlas_family_slugs_valid` has a STRING body (`language sql`, `set
-- search_path = ''`), and Postgres does not dependency-track string bodies.
-- A rename that missed it leaves a function that still COMPILES: every SELECT
-- stays perfectly clean and the 42P01 surfaces only when a CHECK constraint
-- CALLS it — that is, on the first INSERT or UPDATE, in production. So
-- has_function would pass against exactly the broken state this guards. These
-- assertions write rows.

select hasnt_table(
  'public', 'place_super_categories',
  'place_super_categories is gone — a surviving twin means the rename only happened on one side'
);

select ok(
  (select count(*) from pg_constraint
    where conname in ('place_categories_family_keys_valid', 'place_profiles_family_keys_valid')
      and pg_get_constraintdef(oid) like '%atlas_family_slugs_valid%') = 2,
  'both family CHECK constraints call atlas_family_slugs_valid (a CHECK stores the function OID, so it does not follow a create-or-replace under a new name)'
);

-- The other half of the same class: a PL/pgSQL body that still spells the old
-- name compiles too. admin_reset_database and the two seeds are the ones that
-- did; this reads prosrc so the next one cannot hide either.
select is_empty(
  $$select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname ~* 'super_categor' or p.prosrc ~* 'super_categor')$$,
  'no function body still spells super_categor (a string body compiles fine and 42P01s only at call time)'
);

savepoint before_family_write_probe;

select lives_ok(
  $$insert into public.place_categories (slug, label, section, sort_order, family_keys)
    values ('mesita_1857_probe', 'probe', 'Food & Nightlife', 998, array['restaurants'])$$,
  'INSERT into place_categories calls the validator and survives'
);

select throws_ok(
  $$insert into public.place_categories (slug, label, section, sort_order, family_keys)
    values ('mesita_1857_probe_bad', 'probe', 'Food & Nightlife', 997, array['not_a_family'])$$,
  '23514'::char(5), null::text,
  'the validator still REFUSES a slug absent from place_families (so the lives_ok above is not vacuous)'
);

insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-0000000fa111', 'Family Probe');

select lives_ok(
  $$update public.place_profiles set family_keys = array['restaurants', 'cafes_bakeries']
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  'UPDATE of place_profiles.family_keys calls the validator and survives'
);

select throws_ok(
  $$update public.place_profiles set family_keys = array['not_a_family']
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  '23514'::char(5), null::text,
  'place_profiles.family_keys still REFUSES a slug absent from place_families'
);

rollback to savepoint before_family_write_probe;

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
      'place_plans', 'place_categories', 'place_families',
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

-- ━━━ MESITA-1892 — the place is the only tenant ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- THE ACCEPTANCE CRITERION, STATED AS A TEST. The organization layer is not
-- renamed, not parked behind a compatibility view, not left as an unused
-- column — it is gone. 20260915234500 asserts this at the moment it runs; the
-- whole reason this file exists is that a LATER migration can quietly undo an
-- assertion that already passed, and a resurrected tenant layer is exactly the
-- kind of thing a well-meaning migration brings back.
--
-- Extension-owned objects are excluded on purpose: pgTAP itself installs into
-- `public` here, and the claim is about the schema this repo writes.
--
-- THE PATTERN, AND WHY IT IS NOT `%organization%` AND NOT `%org%` EITHER.
-- These three sweeps matched the literal substring `organization` until an
-- audit pointed out that FOUR of the layer's own names sail straight through
-- one: `org_plans`, `org_mesita_pay_enabled`, `claim_place_into_org` and
-- `release_place_from_org`. The layer abbreviated itself and the sweep did not
-- know.
--
-- The obvious widening, `%org%`, is wrong in the other direction — and the
-- third sweep is where it bites, because that one reads FUNCTION BODIES, which
-- are prose as much as SQL. `%org%` condemns a comment that says the lots are
-- "organized by expiry", a country list with Georgia in it, an "organic" menu
-- tag. A sweep that a truthful author cannot satisfy gets deleted, not fixed.
--
-- The layer only ever spelled itself two ways, so that is what the regex
-- matches: the whole word `organization`, or `org`/`orgs` as a COMPLETE TOKEN
-- — fenced on both sides by a separator, where an underscore IS one and a
-- letter is not. `org_plans`, `_from_org` and a bare `org` in prose all fail
-- it; `organic`, `reorganize`, `Georgia` and `morgue` all pass.
--
-- THE FENCE IS SPELLED OUT BY HAND, and `[[:alnum:]]` is deliberately NOT used
-- for it. The first draft of this pattern fenced with `[^[:alnum:]]` and
-- immediately failed on `seed_place_tags`, which seeds the Spanish place tag
-- `'Orgánico'`: under this database's ctype `á` is not alnum, so it counted as
-- a separator and `Org` + `á` read as a complete token. The class below names
-- ASCII letters and digits AND every code point above 0x7F, so an accented
-- letter is a letter — which is the only reading that is true of a schema
-- whose seed data is half in Spanish. The same literal appears in all three
-- sweeps on purpose: a shared helper would be one more thing to keep honest.

select is_empty(
  $$select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and c.relname ~* '(^|[^A-Za-z0-9\u0080-\uffff])orgs?([^A-Za-z0-9\u0080-\uffff]|$)|organization'
       and not exists (
         select 1 from pg_depend d
          where d.objid = c.oid and d.deptype = 'e'
       )$$,
  'no organization table, view or matview survives in public, abbreviated or not (MESITA-1892 removed the layer, it did not rename it)'
);

select is_empty(
  $$select c.table_name || '.' || c.column_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.column_name ~* '(^|[^A-Za-z0-9\u0080-\uffff])orgs?([^A-Za-z0-9\u0080-\uffff]|$)|organization'$$,
  'no organization column survives in public, abbreviated or not (an unused FK is the layer growing back)'
);

-- The tables are gone; a function body that still SAYS organization is the
-- same layer surviving as vocabulary, and it is how the next reader learns a
-- concept the product does not have. This is the sweep the token rule above
-- was designed around — a body is prose as much as SQL, and `claim_place_into_org`
-- was invisible to the old one while "organized" would have been condemned by
-- the naive fix.
select is_empty(
  $$select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and p.prosrc ~* '(^|[^A-Za-z0-9\u0080-\uffff])orgs?([^A-Za-z0-9\u0080-\uffff]|$)|organization'
       and not exists (
         select 1 from pg_depend d
          where d.objid = p.oid and d.deptype = 'e'
       )$$,
  'no function body in public still mentions an organization, abbreviated or not'
);

-- The same five, named. The sweep above would catch any of them, but it fails
-- saying "one organization relation survived"; this one fails saying WHICH,
-- and it is also the only place in the repo that writes down what the layer
-- consisted of, for whoever reads this file after the migration scrolls away.
select is_empty(
  $$select t from unnest(array[
      'public.organizations', 'public.organization_members',
      'public.organization_invites', 'public.organization_guest_customers',
      'public.organization_payment_accounts'
    ]) t
    where to_regclass(t) is not null$$,
  'every table of the organization layer is dropped'
);

-- WHAT THE ORGANIZATION TABLES WERE PROVING, re-pointed. MESITA-1550 asserted
-- organizations and organization_invites were EF-only — RLS on, zero policies,
-- no client SELECT — because a merchant's identity and a pending invite are
-- not the guest's business. The two tables that inherited that data inherit
-- the posture; their client SELECT is asserted with the profiles body, above.

select has_table(
  'public', 'place_payment_accounts',
  'place_payment_accounts stores the Stripe Connect account a place gets paid through'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.place_payment_accounts'::regclass)
  and not exists (
    select 1 from pg_policy where polrelid = 'public.place_payment_accounts'::regclass
  ),
  'place_payment_accounts is EF-only: RLS on with zero policies (RLS and no policy denies every non-service role)'
);

select has_table(
  'public', 'place_guest_customers',
  'place_guest_customers stores which Stripe customer a guest is on the place''s connected account'
);

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.place_guest_customers'::regclass)
  and not exists (
    select 1 from pg_policy where polrelid = 'public.place_guest_customers'::regclass
  ),
  'place_guest_customers is EF-only: RLS on with zero policies'
);

-- ━━━ CRITERION 2 — every tenant-owned record is scoped to a place ━━━━━━━━━━
--
-- The acceptance criterion says "scoped to a place, directly or through an
-- ENFORCED relationship", and the emphasis is the whole test. Asserting that a
-- `place_id` column EXISTS proves nothing: a nullable place_id lets a tenant
-- record float free, which is precisely the state the organization layer used
-- to hold (`places.organization_id` was nullable for years), and a place_id
-- with no foreign key lets it point at a place that was deleted last month.
-- So each of these tables is asserted twice — the column cannot be null, and
-- the database itself resolves it to a real place.
--
-- These use pgTAP's own `col_not_null` / `fk_ok` / `col_is_pk` rather than a
-- hand-rolled catalog query on purpose: a `::regclass` cast naming a table
-- that got dropped RAISES 42P01 and takes the whole file down, reporting
-- nothing at all. These helpers fail one line and keep going.

-- Money. A prepaid balance is a debt to a guest AT A VENUE (MESITA-1892); a
-- lot that is not resolvable to one place is a balance nobody can be asked to
-- honour. `on delete restrict`, not cascade: deleting a place must not be able
-- to delete somebody's money.
select col_not_null(
  'public', 'credit_lots', 'place_id',
  'credit_lots.place_id is NOT NULL (a prepaid balance with no venue is money nobody owes)'
);

select fk_ok(
  'public', 'credit_lots', 'place_id', 'public', 'places', 'id',
  'credit_lots.place_id is a real foreign key to places (scoping is the database''s job, not the caller''s)'
);

-- Billing. The yearly Mesita Membership a place buys.
select col_not_null(
  'public', 'partner_memberships', 'place_id',
  'partner_memberships.place_id is NOT NULL (a subscription that bills nobody in particular)'
);

select fk_ok(
  'public', 'partner_memberships', 'place_id', 'public', 'places', 'id',
  'partner_memberships.place_id is a real foreign key to places'
);

-- ONE LIVE MEMBERSHIP PER PLACE, and the index has to be on the NEW column:
-- the migration dropped the org-scoped version and rebuilt it, and a rebuild
-- that kept the old predicate would let a place carry two live subscriptions
-- and be charged twice. `active` and `past_due` are both live — past_due is a
-- failed payment, not a cancellation, and Stripe will retry it.
select ok(
  exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'partner_memberships_one_live'
       and i.indrelid = to_regclass('public.partner_memberships')
       and i.indisunique
       and i.indnkeyatts = 1
       and (select a.attname from pg_attribute a
             where a.attrelid = i.indrelid and a.attnum = i.indkey[0]) = 'place_id'
       and pg_get_expr(i.indpred, i.indrelid) like '%active%'
       and pg_get_expr(i.indpred, i.indrelid) like '%past_due%'
  ),
  'partner_memberships_one_live is a unique index on (place_id) covering active and past_due (one live membership per place, or the place gets billed twice)'
);

-- The merchant account. One place, one Stripe Connect account — stated as the
-- PRIMARY KEY rather than a unique index, because "at most one" is the shape
-- of the row, not a rule bolted onto it.
select col_is_pk(
  'public', 'place_payment_accounts', array['place_id'],
  'place_payment_accounts is keyed BY the place (one place, one merchant account)'
);

select fk_ok(
  'public', 'place_payment_accounts', 'place_id', 'public', 'places', 'id',
  'place_payment_accounts.place_id is a real foreign key to places'
);

-- The other direction, and it is a money rule: two places sharing one Stripe
-- Connect account means two operators' payouts landing in one bank account.
select col_is_unique(
  'public', 'place_payment_accounts', array['stripe_account_id'],
  'place_payment_accounts.stripe_account_id is unique (one connected account never serves two places)'
);

-- Guest identity on the connected account. The composite key IS the scoping:
-- the same guest is a DIFFERENT Stripe customer at every place, because the
-- connected account is different, and collapsing that to one row per consumer
-- would charge the wrong merchant.
select col_is_pk(
  'public', 'place_guest_customers', array['place_id', 'consumer_id'],
  'place_guest_customers is keyed by (place_id, consumer_id) — a guest is one Stripe customer PER PLACE'
);

select fk_ok(
  'public', 'place_guest_customers', 'place_id', 'public', 'places', 'id',
  'place_guest_customers.place_id is a real foreign key to places'
);

select fk_ok(
  'public', 'place_guest_customers', 'consumer_id', 'public', 'consumers', 'id',
  'place_guest_customers.consumer_id is a real foreign key to consumers'
);

-- WHAT THE ORGANIZATION ROW ITSELF HELD, now columns of the place. Derived
-- from the list rather than asserted one by one, so the failure names the
-- column that went missing: losing any of these silently is the operator's
-- partnership, legal identity, tax ID or Stripe customer disappearing.
select is_empty(
  $$select c from unnest(array[
      'partnered', 'legal_name', 'rfc', 'stripe_billing_customer_id'
    ]) c
    where not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'places'
         and column_name = c
    )$$,
  'places carries every fact the organization row used to hold (partnered, legal_name, rfc, stripe_billing_customer_id)'
);

-- `partnered` is an ENTITLEMENT — every Partner door reads it as a boolean.
-- Nullable, it becomes three-valued, and `not partnered` stops meaning "not a
-- partner" in exactly the readers that gate ticket creation.
select col_not_null(
  'public', 'places', 'partnered',
  'places.partnered is NOT NULL (an entitlement that can be unknown is a door that opens by accident)'
);

-- ━━━ org_plans became membership_plans ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- The plan catalogue was never org-owned data — only its NAME was
-- organizational, so MESITA-1892 renamed it instead of dropping it. That makes
-- it the one piece of the layer's vocabulary with a live successor, and two
-- Edge Functions call `.from("membership_plans")` by that exact string: a
-- rename that lands on one side only is a 404 at checkout, not a test failure.

select has_table(
  'public', 'membership_plans',
  'membership_plans exists (the Membership plan vocabulary two Edge Functions read by name)'
);

select hasnt_table(
  'public', 'org_plans',
  'org_plans is gone (renamed, not copied — two catalogues would drift and one of them prices real subscriptions)'
);

-- AND THE RENAME REACHED THE SURVIVOR REGISTRY. admin_reset_database TRUNCATES
-- every public table that admin_reset_preserve does not name, so a registry
-- row still saying `org_plans` does not merely go stale — it drops the plan
-- catalogue, and its Stripe price ids, on the next Reset. The sweep above
-- ("every admin_reset_preserve row names a live public table") would catch the
-- stale row; this catches the missing one, which is the half that loses data.
select ok(
  exists (
    select 1 from public.admin_reset_preserve
     where table_name = 'membership_plans'
  ),
  'admin_reset_preserve names membership_plans (an unregistered table is TRUNCATED by the next admin reset)'
);

-- THE LAST-OWNER BACKSTOP, re-pointed rather than reinvented. MESITA-1550 put
-- a DEFERRED CONSTRAINT TRIGGER on organization_members because ≥1 owner is a
-- claim about the rows that REMAIN after a statement, which an app-level
-- count-then-act cannot make. The place side states the other direction of the
-- same fact — at most one owner per place — and a partial unique index CAN say
-- that, atomically, with no trigger. Asserting the index that exists beats
-- inventing a trigger to keep the shape of an assertion whose table is gone.
select ok(
  exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'place_members_one_owner_per_place'
       and i.indrelid = 'public.place_members'::regclass
       and i.indisunique
       and i.indpred is not null
  ),
  'place_members_one_owner_per_place is a partial unique index (one owner per place, enforced by the database)'
);

-- THE RFC RULE, both halves, on its new table. _shared/place-rfc.ts matches
-- `places_rfc_unique` BY NAME to turn a 23505 into a sentence a merchant can
-- act on, so the index name is contract, not decoration.
select ok(
  exists (
    select 1 from pg_constraint
     where conrelid = 'public.places'::regclass
       and conname = 'places_rfc_shape'
       and contype = 'c'
  ),
  'places_rfc_shape still checks the RFC shape (a malformed tax ID must never reach a CFDI)'
);

select ok(
  exists (
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'places_rfc_unique'
       and i.indrelid = 'public.places'::regclass
       and i.indisunique
       and i.indpred is not null
  ),
  'places_rfc_unique is a partial unique index (one RFC is one merchant; NULL means not paid yet)'
);

-- THE PAY BIT IS ONE BIT NOW. It was `place AND organization`; the second half
-- was folded into place_profiles before the layer went, so the capability
-- every reader sees is unchanged and stated in exactly one column.
select has_column(
  'public', 'profiles', 'mesita_pay_enabled',
  'profiles still exposes mesita_pay_enabled (every Pay door reads it here)'
);

select is(
  (select count(*)::int
     from pg_depend d
     join pg_rewrite r
       on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
     join pg_attribute a
       on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
    where r.ev_class = 'public.profiles'::regclass
      and d.refobjid = 'public.place_profiles'::regclass
      and a.attname = 'mesita_pay_enabled'),
  1,
  'profiles.mesita_pay_enabled reads place_profiles.mesita_pay_enabled and nothing else (one bit, one writer)'
);

select * from finish();

rollback;
