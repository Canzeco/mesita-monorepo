-- MESITA-4238 — the re-pick's write door: compare-and-write, an undo row in the
-- same transaction, operator and in-flight guards, and the documented revert.

begin;

create extension if not exists pgtap with schema public;

select plan(12);

insert into public.place_profiles (id, google_name, family_keys, enrichment_sources) values
  ('00000000-0000-4000-8000-000000014238', 'Repick Null', null, '{}'::jsonb),
  ('00000000-0000-4000-8000-000000024238', 'Repick List', array['family','dinner','mexican'], '{}'::jsonb),
  ('00000000-0000-4000-8000-000000034238', 'Repick Owned', array['family'], '{"operator_fields":["family_keys"]}'::jsonb),
  ('00000000-0000-4000-8000-000000044238', 'Repick Malformed', array['family'], '{"operator_fields":{"family_keys":true}}'::jsonb),
  ('00000000-0000-4000-8000-000000054238', 'Repick Busy', array['family'], '{}'::jsonb);
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014238', 'mesita-4238-null', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000024238', 'mesita-4238-list', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000034238', 'mesita-4238-owned', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000044238', 'mesita-4238-malformed', 'active', 'ready', 'MXN'),
  ('00000000-0000-4000-8000-000000054238', 'mesita-4238-busy', 'active', 'generating', 'MXN');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000014238', null, array['coffee'], 'run-4238', null, 'repick-families-agent'),
  'written', 'a null list compares (is not distinct from) and is written');

select is(
  (select family_keys from public.place_profiles where id = '00000000-0000-4000-8000-000000014238'),
  array['coffee'], 'the new list landed');

select is(
  (select count(*)::int from public.admin_operator_events
    where place_id = '00000000-0000-4000-8000-000000014238' and source = 'repick-families-agent'
      and detail->>'run_id' = 'run-4238' and detail->'before' = 'null'::jsonb and detail->'after' = '["coffee"]'::jsonb),
  1, 'one undo row with the old and new lists, in the same transaction');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000024238', array['family'], array['mexican'], 'run-4238', null, 'repick-families-agent'),
  'stale', 'a list that changed since it was read is not overwritten');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000024238', array['family','dinner','mexican'], array['mexican','tacos'], 'run-4238', null, 'repick-families-agent'),
  'written', 'the read list compares and is replaced');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000034238', array['family'], array['coffee'], 'run-4238', null, 'repick-families-agent'),
  'owned', 'an operator-owned list is never touched');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000044238', array['family'], array['coffee'], 'run-4238', null, 'repick-families-agent'),
  'written', 'a malformed operator_fields is not ownership (same reading as readOperatorFields)');

select is(
  public.admin_repick_family_keys('00000000-0000-4000-8000-000000054238', array['family'], array['coffee'], 'run-4238', null, 'repick-families-agent'),
  'generating', 'a place with an Enrich in flight is skipped');

select throws_ok(
  $$select public.admin_repick_family_keys('00000000-0000-4000-8000-000000024238', array['mexican','tacos'], array[]::text[], 'run-4238', null, 'repick-families-agent')$$,
  '22023', null, 'an empty list is refused: the re-pick never hides a place');

-- The revert statement Docs › Atlas gives, run as written.
update public.place_profiles pp
   set family_keys = case when jsonb_typeof(e.detail->'before') = 'array'
                          then array(select jsonb_array_elements_text(e.detail->'before')) end
  from public.admin_operator_events e
 where e.source like 'repick-families%'
   and e.detail->>'run_id' = 'run-4238'
   and pp.id = e.place_id
   and pp.family_keys is not distinct from
       (case when jsonb_typeof(e.detail->'after') = 'array'
             then array(select jsonb_array_elements_text(e.detail->'after')) end);

select is(
  (select family_keys from public.place_profiles where id = '00000000-0000-4000-8000-000000014238'),
  null::text[], 'the revert restores a null list');

select is(
  (select family_keys from public.place_profiles where id = '00000000-0000-4000-8000-000000024238'),
  array['family','dinner','mexican'], 'the revert restores the old list');

select ok(
  not has_function_privilege('authenticated', 'public.admin_repick_family_keys(uuid, text[], text[], text, uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_repick_family_keys(uuid, text[], text[], text, uuid, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.admin_repick_family_keys(uuid, text[], text[], text, uuid, text)', 'EXECUTE'),
  'only the service role may call it');

select * from finish();

rollback;
