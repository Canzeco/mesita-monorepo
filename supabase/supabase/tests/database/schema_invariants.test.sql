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

select plan(140);

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
-- (MESITA-1892), and the column that tripped it (`mesita_pay_enabled`) went
-- with the First Stage cut (MESITA-2091), but the lesson is about the NEXT
-- derived column, not that one, so the probe stays. It reads every column
-- the view takes from `places` (the column-granted half) plus one generated
-- `place_profiles` column, so a lost column grant fails here by name.
--
-- So: run the read. This is the only assertion in the file that proves the
-- guest browse works rather than that a privilege bit is set.
create or replace function pg_temp.client_role_reads_profiles(role_name text)
returns text language plpgsql as $probe$
declare verdict text;
begin
  begin
    execute format('set local role %I', role_name);
    perform id, slug, state, content_state, currency, name from public.profiles limit 1;
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
  'service_role keeps table SELECT on public.places (every place EF reads it)'
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
         -- MESITA-2091 dropped every one of these columns; the slot stays so
         -- one that comes back cannot come back client-readable.
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

-- Re-pointed from places.plan, which MESITA-2091 dropped. `state` is the
-- column RLS filters on AND the view projects, so losing its grant breaks
-- the guest browse twice over.
select ok(
  has_column_privilege('anon', 'public.places', 'state', 'SELECT'),
  'anon keeps SELECT on places.state (profiles invoker reads it; RLS filters on it)'
);

-- The set IS the claim, so it is derived, not typed: every `places` column the
-- `profiles` body references, read straight out of the view's rewrite rule. A
-- hand-listed column (`state`, above) can only catch the loss of a column
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

select ok(
  has_table_privilege('anon', 'public.place_profiles', 'SELECT'),
  'anon keeps table SELECT on public.place_profiles (Approach D is unimplementable)'
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

-- ━━━ Identity — a guest is a person, not a class or a plan ━━━━━━━━━━━━━━━━━━
--
-- MESITA-2091 dropped classes, consumer plans and their subscriptions. What a
-- consumer row keeps: who they are, their member number, their Instagram,
-- and the tombstone.

select is_empty(
  $$select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'consumers'
       and (column_name like 'class\_%' or column_name like 'invitation\_%'
            or column_name like 'privacy\_%'
            or column_name in ('plan', 'stripe_customer_id'))$$,
  'consumers keeps no class, plan, invitation, privacy or Stripe column (First Stage has none of them)'
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

-- MESITA-1305 taught that a Reset body which still writes a retired table or
-- column aborts the button at the worst moment, and the classes / plan
-- reseeds it used to carry are exactly that now. Probe the live function
-- text, not a fixture: a CREATE OR REPLACE that copied an older body back
-- would resurrect them.
select ok(
  pg_get_functiondef('public.admin_reset_database()'::regprocedure)
    !~ '\y(classes|consumer_plans|place_plans|membership_plans)\y',
  'admin_reset_database reseeds no dropped vocabulary (classes, consumer_plans, place_plans, membership_plans)'
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
  'no public relation still has a ticket_code column — schema-wide, matching its project_id twin from the same cutover'
);

select is_empty(
  $$select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'place_profiles'
       and column_name in ('tiktok_url', 'tripadvisor_url', 'yelp_url')$$,
  'dead place URL columns are gone'
);

-- Inverted by MESITA-2091. The four NULL/false dummies existed only so EFs
-- deployed before their columns dropped could still SELECT them; nothing
-- reads them now, and a dummy that comes back is a column nobody can write.
select ok(
  (
    select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in ('tiktok_url', 'tripadvisor_url', 'yelp_url', 'requires_story')
  ) = 0,
  'profiles no longer projects the four dummy leftover columns'
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

-- Inverted by MESITA-2091. This pinned is_place_member (renamed from
-- is_project_member by MESITA-1590) because nine storage policies called it.
-- Place members are gone, those policies now ask is_super_admin() alone, and
-- a surviving is_place_member would be a door that reads a dropped table.
select ok(
  not exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'is_place_member'
  ),
  'is_place_member is gone (no place members; place-bucket writes are super-admin only)'
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
  'app_config.memo_config holds Memo greeting/instructions'
);

-- ━━━ app_config — the Second Stage blobs are gone ━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- MESITA-2091. controls_config (Credits terms), promos_config (the rewards
-- grid), ojo_config, orders_config, visits_config and verification_config
-- each configured something First Stage does not have.

select is_empty(
  $$select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'app_config'
       and column_name in ('controls_config', 'promos_config', 'ojo_config',
                           'orders_config', 'visits_config', 'verification_config')$$,
  'app_config holds no Second Stage blob (Credits, rewards grid, Ojo, orders, visits, verification)'
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

-- Social v1 (MESITA-2442): EF-only, and its readers are service_role only.
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.place_activity'::regclass)
    and not has_table_privilege('anon', 'public.place_activity', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_activity', 'SELECT'),
  'place_activity is EF-only (RLS on, no client SELECT)'
);

select ok(
  not has_function_privilege('authenticated', 'public.place_activity_feed(integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_activity_people(uuid, integer)', 'EXECUTE'),
  'client roles cannot run the Social readers (they name other members)'
);

-- MESITA-2548: Diamond and Plan, two consumer facts; plain by default.
select ok(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'consumers'
      and column_name = 'diamond') = 'false'
    and (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'consumers'
      and column_name = 'plan') like '''free''%',
  'consumers.diamond defaults to false and consumers.plan to free (MESITA-2548)'
);

select ok(
  exists (select 1 from pg_constraint
           where conname = 'consumers_plan_check'
             and conrelid = 'public.consumers'::regclass),
  'consumers.plan is free or premium (MESITA-2548)'
);

-- MESITA-2461: a handle is proved, not typed.
select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.consumer_instagram_claims'::regclass)
    and not has_table_privilege('anon', 'public.consumer_instagram_claims', 'SELECT')
    and not has_table_privilege('authenticated', 'public.consumer_instagram_claims', 'SELECT'),
  'consumer_instagram_claims is EF-only (RLS on, no client SELECT)'
);

select ok(
  not has_function_privilege('authenticated', 'public.consumer_instagram_verify(uuid, text, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consumer_instagram_verify(uuid, text, integer)', 'EXECUTE'),
  'client roles cannot stamp a handle verified'
);

select ok(
  pg_get_functiondef('public.place_activity_visible(public.consumers)'::regprocedure)
    like '%instagram_verified_at is not null%',
  'Social shows only verified Instagram handles'
);

select col_default_is(
  'public', 'consumers', 'show_activity', 'true',
  'consumers.show_activity defaults on (Show my activity)'
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

-- MESITA-2420. A vote at the threshold starts an Enrich run on Render, and the
-- run's one write refuses a profile whose updated_at moved after it started.
-- A vote bumps request_count alone, so it must not stamp updated_at, or one
-- more guest voting mid-run throws the run's profile away.
select ok(
  (select pg_get_triggerdef(t.oid) ~ 'WHEN .*old\.request_count IS DISTINCT FROM new\.request_count'
     from pg_trigger t
    where t.tgrelid = 'public.place_profiles'::regclass
      and t.tgname = 'place_profiles_set_updated_at'
      and not t.tgisinternal),
  'a vote (request_count alone) does not stamp place_profiles.updated_at'
);

select has_table(
  'public', 'place_families',
  'place family vocabulary exists'
);

select is(
  (select count(*)::bigint from public.place_families),
  13::bigint,
  'place family catalog is twelve guest families plus Undefined (MESITA-2486)'
);

select is(
  (select label from public.place_families where slug = 'undefined'),
  'Undefined',
  'the leftover family is labelled Undefined'
);

select is(
  (select array_agg(slug order by sort_order) from public.place_families),
  array['coffee','breakfast','quick_bite','pizza','tacos','sushi','burgers',
        'noodles','dinner','sweet','drinks','night_out',
        'undefined']::text[],
  'family catalog order is the twelve guest rails, Undefined last'
);

select is(
  (select family_keys from public.place_categories where slug = 'breakfast'),
  array['breakfast']::text[],
  'breakfast is the breakfast rail'
);

select is(
  (select family_keys from public.place_categories where slug = 'karaoke'),
  array['night_out']::text[],
  'karaoke is a night out (MESITA-2486)'
);

select is(
  (select array_agg(slug order by slug) from public.place_categories
    where 'night_out' = any(family_keys) and slug <> 'night_club'),
  array['billiards','board_game_cafe','escape_room','karaoke']::text[],
  'Night out took Go out whole and holds no attraction (MESITA-2438, MESITA-2486)'
);

select is(
  (select family_keys from public.place_categories where slug = 'bakery'),
  array['sweet','breakfast']::text[],
  'a bakery is Sweet first, Breakfast second: family_keys is primary first (MESITA-2438)'
);

select is(
  (select count(*)::bigint from public.place_categories
    where cardinality(family_keys) = 2),
  4::bigint,
  'four categories sit on two families (karaoke left Go out, MESITA-2486)'
);

select is(
  (select count(*)::bigint from public.place_categories
    where family_keys && array['move','feel_better']::text[]),
  0::bigint,
  'no category sits on Move or Feel better: both families are gone (MESITA-2468)'
);

select is(
  (select array_agg(distinct k) from public.place_categories,
     unnest(family_keys) as k
    where slug in ('gym','padel_club','spa','barbershop','hair_salon','yoga_studio')),
  array['undefined']::text[],
  'a gym, a padel club, a spa, a barbershop, a salon and a yoga studio are in no family (MESITA-2468)'
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

select ok(
  (select max(cardinality(family_keys)) from public.place_categories) between 1 and 15,
  'a category sits on at least one family and not more than the catalog'
);

select ok(
  position(
    'cardinality(slugs) <= 15' in pg_get_functiondef('public.atlas_family_slugs_valid(text[])'::regprocedure)
  ) > 0,
  'a category is not capped at two families'
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
    values ('mesita_1857_probe', 'probe', 'Food & Nightlife', 998, array['dinner'])$$,
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

-- profiles is places JOIN place_profiles. A profile row alone is invisible
-- there, so the catalog assertions below would read NULL.
insert into public.places (id, slug, state, content_state, currency)
values (
  '00000000-0000-4000-8000-0000000fa111',
  'mesita-1857-probe',
  'active',
  'generating',
  'MXN'
);

select lives_ok(
  $$update public.place_profiles set family_keys = array['dinner', 'coffee']
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  'a place write survives when a family list is offered'
);

select is(
  (select family_keys from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  null::text[],
  'a place does not keep the family list — membership comes from the category'
);

select lives_ok(
  $$update public.place_profiles set family_keys = array['not_a_family']
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  'an unknown family slug is not stored on the place'
);

select is(
  (select family_keys from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  null::text[],
  'the unknown family slug was dropped instead of saved'
);

select throws_ok(
  $$update public.place_profiles set category = 'not_a_category'
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  'P0001'::char(5), null::text,
  'an unknown category is refused'
);

select lives_ok(
  'update public.place_profiles set tags = array[' ||
    quote_literal((select slug from public.place_tags order by sort_order, slug limit 1)) ||
  '] where id = ''00000000-0000-4000-8000-0000000fa111''',
  'a catalog tag is accepted'
);

select throws_ok(
  $$update public.place_profiles set tags = array['not_a_tag']
     where id = '00000000-0000-4000-8000-0000000fa111'$$,
  'P0001'::char(5), null::text,
  'an unknown tag is refused'
);

select lives_ok(
  $$update public.place_categories
       set family_keys = array['dinner', 'coffee', 'drinks', 'night_out']
     where slug = 'mesita_1857_probe'$$,
  'a category can belong to more than two families'
);

update public.place_profiles
   set category = 'mesita_1857_probe'
 where id = '00000000-0000-4000-8000-0000000fa111';

select is(
  (select family_keys from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  null::text[],
  'pointing a place at that category does not store the families on the place'
);

select is(
  (select family_keys from public.profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  array['dinner', 'coffee', 'drinks', 'night_out']::text[],
  'the catalog view reads the four-family mapping'
);

select lives_ok(
  $$update public.place_categories
       set family_keys = array['dinner', 'coffee', 'night_out']
     where slug = 'mesita_1857_probe'$$,
  'the mapping can change again'
);

select is(
  (select family_keys from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  null::text[],
  'changing the mapping does not write families onto the place'
);

select is(
  (select family_keys from public.profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  array['dinner', 'coffee', 'night_out']::text[],
  'the catalog view follows the new mapping'
);

select lives_ok(
  'update public.place_profiles set category = null, tags = array[' ||
    quote_literal((select slug from public.place_tags order by sort_order, slug limit 1)) || ',' ||
    quote_literal((select slug from public.place_tags order by sort_order, slug offset 1 limit 1)) ||
  '] where id = ''00000000-0000-4000-8000-0000000fa111''',
  'several tags are accepted and a blank category is still one category'
);

select is(
  (select category from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  'undefined',
  'a blank category becomes the single category undefined'
);

select is(
  (select cardinality(tags) from public.place_profiles
    where id = '00000000-0000-4000-8000-0000000fa111'),
  2,
  'a place keeps more than one tag'
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
      'app_config', 'super_admins', 'place_categories', 'place_families',
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

-- WHAT THE ORGANIZATION TABLES WERE PROVING went with them. MESITA-1892
-- re-pointed the EF-only posture, the place scoping and the one-live-
-- membership rule onto place_payment_accounts, place_guest_customers,
-- place_api_keys, credit_lots, partner_memberships and place_members.
-- MESITA-2091 dropped all six (First Stage takes no money and has no place
-- members), so those assertions went with their tables; the First Stage
-- section below asserts the tables are gone instead. One survivor of that
-- block still holds: the renamed plan catalogue must not come back under its
-- organizational name.

select hasnt_table(
  'public', 'org_plans',
  'org_plans is gone (renamed to membership_plans by MESITA-1892, then dropped with it by MESITA-2091)'
);

-- ━━━ MESITA-2091 — the First Stage cut ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Pato, 2026-10-10: "kill the unused supabase tables / kill the unused
-- supabase columns". First Stage is Citywide Catalog · Discovery Engines ·
-- Reservations Agent. These assertions write down what the cut removed, for
-- the same reason the organization block above does: a later migration that
-- quietly brings one back is exactly what this file exists to catch.
--
-- Every set below is NAMED, not derived: the claim is "these specific things
-- are gone", and a derived set cannot name what it never saw. to_regclass /
-- information_schema are used rather than ::regclass casts, which raise on a
-- missing relation and take the whole file down.

select is_empty(
  $$select t from unnest(array[
      'classes', 'consumer_connectors', 'consumer_invite_codes', 'consumer_plans',
      'consumer_review_claims', 'consumer_subscriptions', 'credit_gift_redeem_events',
      'credit_gifts', 'credit_ledger', 'credit_lots', 'favorites', 'managers',
      'membership_plans', 'partner_memberships', 'place_api_keys',
      'place_field_proposals', 'place_guest_customers', 'place_invites',
      'place_members', 'place_payment_accounts', 'place_plans', 'place_strikes',
      'place_subscriptions', 'place_verifications', 'stripe_events',
      'ticket_check_events', 'ticket_reports', 'ticket_reviews',
      'visit_ticket_payments', 'visit_tickets'
    ]) t
    where to_regclass('public.' || t) is not null$$,
  'every Second Stage table is dropped (claims, members, verification, plans, memberships, tickets, Credits, Stripe, classes, favorites)'
);

select is_empty(
  $$select table_name || '.' || column_name from information_schema.columns
     where table_schema = 'public'
       and (
         (table_name = 'places' and column_name in (
           'listing_type', 'plan', 'fiscal_type', 'segmentation_basic_enabled',
           'segmentation_advanced_enabled', 'welcome_free_rate', 'welcome_premium_rate',
           'free_rate', 'premium_rate', 'monthly_promo_cap', 'discount_cap_cents',
           'staff_channel_pinged_at', 'first_ticket_honored_at', 'plan_live_at',
           'strike_count', 'last_strike_at', 'promo_paused_until', 'plan_forfeited_at',
           'check_pin', 'reward_lane_pending_review_at', 'claimed_by', 'claimed_at',
           'claim_reviewed_at', 'claim_reviewed_by', 'partnered', 'legal_name', 'rfc',
           'stripe_billing_customer_id'))
         or (table_name = 'place_profiles' and column_name in (
           'whatsapp_pr_urls', 'instagram_pr_urls', 'google_business_url',
           'google_visitor_count', 'mesita_stars_overall', 'mesita_stars_food',
           'mesita_stars_service', 'mesita_stars_ambience', 'mesita_stars_value',
           'mesita_review_count', 'mesita_visitor_count', 'description_es',
           'order_channel', 'order_target', 'orders_enabled', 'mesita_pay_enabled',
           'credits_enabled', 'pickup_orders_enabled', 'delivery_orders_enabled'))
       )$$,
  'places and place_profiles keep no Second Stage column (plan, listing, rates, strikes, claims, fiscal identity, Mesita reviews, orders, Pay, Credits)'
);

-- The view half of the same claim. `currency` is deliberately NOT here: it
-- still formats the consumer price range.
select is_empty(
  $$select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name in (
         'listing_type', 'plan', 'fiscal_type', 'segmentation_basic_enabled',
         'segmentation_advanced_enabled', 'welcome_free_rate', 'welcome_premium_rate',
         'free_rate', 'premium_rate', 'monthly_promo_cap', 'discount_cap_cents',
         'staff_channel_pinged_at', 'first_ticket_honored_at', 'plan_live_at',
         'strike_count', 'last_strike_at', 'promo_paused_until', 'plan_forfeited_at',
         'reward_lane_pending_review_at', 'whatsapp_pr_urls', 'instagram_pr_urls',
         'google_business_url', 'google_visitor_count', 'mesita_stars_overall',
         'mesita_stars_food', 'mesita_stars_service', 'mesita_stars_ambience',
         'mesita_stars_value', 'mesita_review_count', 'mesita_visitor_count',
         'description_es', 'order_channel', 'order_target', 'orders_enabled',
         'mesita_pay_enabled')$$,
  'public.profiles projects no Second Stage column'
);

-- Function bodies are strings, so every one of these would have survived its
-- tables and 42P01'd on its next call.
select is_empty(
  $$select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'apply_ticket_credits', 'spend_credits', 'create_credit_lot',
         'create_credit_gift', 'cancel_credit_gift', 'redeem_credit_gift',
         'reverse_credit_lot', 'get_credit_liability', 'get_credit_spend_report',
         'sweep_expired_credit_lots', 'credit_lots_place_immutable',
         'record_visit_tenders', 'visit_tickets_enforce_tender_sum_on_reveal',
         'refresh_place_mesita_reviews', 'tg_ticket_reviews_refresh_place',
         'claim_place', 'release_place', 'mark_place_claim_reviewed')$$,
  'every function that served a dropped table is dropped (a string body outlives its table and fails at call time)'
);

select is_empty(
  $$select t.typname from pg_type t
     where t.typnamespace = 'public'::regnamespace
       and t.typname in (
         'ticket_state', 'story_state', 'member_role', 'verification_method',
         'verification_state', 'field_proposal_status', 'plan', 'listing_type',
         'place_fiscal_type')$$,
  'every Second Stage enum is dropped (content_state, place_state and reservation_state stay)'
);

-- A job pointed at a dropped function errors every hour, forever, and nothing
-- else reads cron.job.
select is_empty(
  $$select jobname from cron.job where jobname = 'sweep-expired-credit-lots'$$,
  'the Credits expiry sweep is unscheduled'
);

-- MESITA-2206. The job stays so a resume is alter_job(..., active := true).
-- A replay that schedules it active again fails here.
select is(
  (select active from cron.job where jobname = 'run-place-enrichment-stages'),
  false,
  'the Enricher stage poller ships paused'
);

-- web-admin uploads gallery photos and menus to these buckets straight from
-- the browser (lib/place-upload-utils.ts). Losing a write policy is a 403 on
-- every upload; keeping a member path open is a door for a role that no
-- longer exists. So: all nine exist, every one asks is_super_admin(), and
-- none asks anything else about the caller.
select is(
  (select count(*)::int from pg_policy
    where polrelid = 'storage.objects'::regclass
      and polname in (
        'place_images_admin_insert', 'place_images_admin_update', 'place_images_admin_delete',
        'menu_images_admin_insert', 'menu_images_admin_update', 'menu_images_admin_delete',
        'menu_pdfs_admin_insert', 'menu_pdfs_admin_update', 'menu_pdfs_admin_delete')
      and (coalesce(pg_get_expr(polqual, polrelid), '')
           || coalesce(pg_get_expr(polwithcheck, polrelid), '')) like '%is_super_admin()%'
      and (coalesce(pg_get_expr(polqual, polrelid), '')
           || coalesce(pg_get_expr(polwithcheck, polrelid), '')) not like '%member%'),
  9,
  'the nine place-bucket write policies exist and admit super admins only'
);

select is_empty(
  $$select polname from pg_policy
     where polrelid = 'storage.objects'::regclass
       and (polname like '%member_or_admin%' or polname like 'ticket_proofs%')$$,
  'no member_or_admin or ticket-proofs storage policy survives'
);

select is_empty(
  $$select id from storage.buckets where id = 'ticket-proofs'$$,
  'the ticket-proofs bucket is gone (MESITA-2131)'
);

-- The enrichment poller posts to the enricher-* stage functions (MESITA-2132);
-- the supabase-cron-enrich-place-* slugs it used to call are retired.
select ok(
  (select prosrc like '%/functions/v1/enricher-cron-enrich-place-%'
          and prosrc not like '%supabase-cron-enrich-place-%'
     from pg_proc where oid = 'public.run_place_enrichment_stages()'::regprocedure),
  'run_place_enrichment_stages calls enricher-cron-enrich-place-<stage>'
);

-- Me › Notifications (MESITA-2080) is kept; its visit-ticket coupling is not.
-- The CHECK must admit exactly what notification-row.tsx RESERVATION_KINDS
-- renders and refuse the retired ticket kinds — proved by writing rows.
select hasnt_column(
  'public', 'consumer_notifications', 'ticket_id',
  'consumer_notifications.ticket_id is gone (a notification is no longer about a visit ticket)'
);

savepoint before_notification_probe;

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000a2091');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000000a2091');

select lives_ok(
  $$insert into public.consumer_notifications (consumer_id, kind)
    values ('00000000-0000-4000-8000-0000000a2091', 'reservation'),
           ('00000000-0000-4000-8000-0000000a2091', 'booking')$$,
  'consumer_notifications accepts the two reservation kinds Me › Notifications renders'
);

select throws_ok(
  $$insert into public.consumer_notifications (consumer_id, kind)
    values ('00000000-0000-4000-8000-0000000a2091', 'bill')$$,
  '23514'::char(5), null::text,
  'consumer_notifications refuses the retired ticket kinds (bill, review)'
);

rollback to savepoint before_notification_probe;

-- The INSTEAD OF bodies were rewritten without the dropped columns. The
-- trigger checks above prove they are BOUND; this proves they WORK, on both
-- halves of the join — a body that still named a dropped column would
-- compile and then 42703 here.
savepoint before_profiles_write_probe;

select lives_ok(
  $$insert into public.profiles (slug, name, state)
    values ('mesita-2091-probe', 'First Stage Probe', 'active')$$,
  'an INSERT through public.profiles writes both places and place_profiles'
);

update public.profiles set currency = 'USD', pitch = 'probe'
 where slug = 'mesita-2091-probe';

select is(
  (select u.currency || '/' || p.pitch
     from public.places u join public.place_profiles p on p.id = u.id
    where u.slug = 'mesita-2091-probe'),
  'USD/probe'::text,
  'an UPDATE through public.profiles reaches both halves of the join'
);

rollback to savepoint before_profiles_write_probe;

-- ━━━ The schema residue is gone (MESITA-2145) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- What the First Stage cut and the dead-code sweep left with no reader:
-- the name history, the per-place schedule, eight place fields, a handful of
-- small columns, five enum labels and the dead app_config keys.

select hasnt_table('public', 'place_name_history',
  'place_name_history is gone (its only reader was a dead search mode)');

select is(
  (select count(*)::bigint from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('queue_due_place_enrichments', 'place_name_history_capture')),
  0::bigint,
  'the schedule queue and the name-history trigger function are gone'
);

select is(
  (select count(*)::bigint from information_schema.columns
    where table_schema = 'public'
      and (table_name, column_name) in (
        ('place_profiles', 'vibe'), ('place_profiles', 'email'),
        ('place_profiles', 'country'), ('place_profiles', 'details'),
        ('place_profiles', 'editorial_summary'), ('place_profiles', 'established_year'),
        ('place_profiles', 'executive_chef'), ('place_profiles', 'facebook_rating'),
        ('place_profiles', 'enrich_every_days'), ('place_profiles', 'enrich_mode'),
        ('place_profiles', 'enrich_next_at'),
        ('consumer_notifications', 'state'), ('consumer_notifications', 'resolved_at'),
        ('consumers', 'country'), ('super_admins', 'phone'),
        ('place_tags', 'section'), ('reservation_tickets', 'completed_at'))),
  0::bigint,
  'the seventeen residue columns are gone'
);

select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
    where enumtypid = 'public.place_state'::regtype),
  array['active', 'paused', 'archived'],
  'place_state is active / paused / archived (lead and the review labels are gone)'
);

select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
    where enumtypid = 'public.content_state'::regtype),
  array['generating', 'ready', 'failed'],
  'content_state is generating / ready / failed (queued is gone)'
);

select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum
    where enumtypid = 'public.reservation_state'::regtype),
  array['pending', 'confirmed', 'declined', 'cancelled', 'unreachable', 'unresolved'],
  'reservation_state has no no_show'
);

select ok(
  (select pg_get_expr(polqual, polrelid) !~ '(lead|queued)'
     from pg_policy
    where polrelid = 'public.places'::regclass
      and polname = 'places_select_public_visible'),
  'places_select_public_visible exists and names no retired label'
);

select ok(
  (select not (reservations_config ?| array['disabled', 'priority', 'attempts'])
      and reservations_config #> '{testCall,consumerNumber}' is null
      and not (models_config ?| array['supabase', 'ojo'])
      and models_config #> '{memo,perplexity}' is null
      and not (memo_config ?| array['provider', 'openaiModel', 'webGrounding', 'perplexityModel'])
      and not (discovery_config ?| array['social', 'slotting'])
      -- MESITA-2337: the deck's keys (MESITA-2328), `catalog.ranking`
      -- (MESITA-2327) and the operator `filters` have no reader.
      and not (discovery_config ?| array['filters', 'swipe', 'engines', 'weights', 'weightsByMode'])
      and discovery_config #> '{catalog,ranking}' is null
      -- MESITA-2431: `params` holds only what normalizeSignalParams reads;
      -- the first calibration's keys (MESITA-2347) are gone from the row.
      -- MESITA-2439 added `selected` (Selected's value for other places).
      and (coalesce(discovery_config -> 'params', '{}'::jsonb)
             - 'proximity' - 'popularity' - 'selected' - 'modes') = '{}'::jsonb
      and (coalesce(discovery_config #> '{params,proximity}', '{}'::jsonb) - 'reachKm') = '{}'::jsonb
      and (coalesce(discovery_config #> '{params,popularity}', '{}'::jsonb) - 'halfReviews') = '{}'::jsonb
      and (coalesce(discovery_config #> '{params,selected}', '{}'::jsonb) - 'otherFactor') = '{}'::jsonb
      and not (enrichment_config ? 'atlasPerRunCostCapUsd')
     from public.app_config where id = 1),
  'no dead app_config key survives'
);

select * from finish();

rollback;
