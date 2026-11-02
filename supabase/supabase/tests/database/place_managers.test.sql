-- MESITA-3103 — who runs a place: EF-only tables, one row per (place, guest),
-- approval and the queue move together, and the code-send limits hold.

begin;

create extension if not exists pgtap with schema public;

select plan(11);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3103'),
  ('00000000-0000-4000-8000-0000000b3103');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3103'),
  ('00000000-0000-4000-8000-0000000b3103');
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003103', 'Owner Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003103', 'mesita-3103-probe', 'active', 'generating', 'MXN');

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.place_managers'::regclass, 'public.place_verification_requests'::regclass,
                  'public.place_verification_sends'::regclass))
    and not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('place_managers', 'place_verification_requests', 'place_verification_sends')),
  'ownership tables have RLS on and no policy: the EF-only lockdown'
);

select ok(
  not has_table_privilege('anon', 'public.place_managers', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_managers', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_managers', 'INSERT')
    and not has_table_privilege('authenticated', 'public.place_verification_requests', 'INSERT')
    and not has_table_privilege('authenticated', 'public.place_verification_sends', 'INSERT')
    and not has_function_privilege('authenticated',
      'public.place_verification_approve(uuid, uuid, text, integer, uuid, text, text)', 'EXECUTE')
    and not has_function_privilege('anon',
      'public.place_take_verification_send(uuid, uuid, text)', 'EXECUTE'),
  'client roles hold nothing on ownership; its RPCs are service-role only'
);

-- ━━━ The queue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.place_verification_requests (id, place_id, consumer_id, name, role)
values ('00000000-0000-4000-8000-0000000c3103', '00000000-0000-4000-8000-000000003103',
        '00000000-0000-4000-8000-0000000a3103', 'Ana', 'Owner');

select throws_ok(
  $$insert into public.place_verification_requests (place_id, consumer_id, name, role)
    values ('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000a3103', 'Ana', 'Owner')$$,
  '23505', null,
  'a guest has one pending request per place'
);

select isnt(
  place_verification_approve('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000a3103',
    'review', 365, '00000000-0000-4000-8000-0000000c3103', 'pato@canzeco.com', null),
  null,
  'approving a pending request writes the row'
);

select is(
  (select status from public.place_verification_requests where id = '00000000-0000-4000-8000-0000000c3103'),
  'approved',
  'the request closes as approved in the same call'
);

select is(
  place_verification_approve('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000a3103',
    'review', 365, '00000000-0000-4000-8000-0000000c3103', 'pato@canzeco.com', null),
  null,
  'approving the same request twice does nothing'
);

-- ━━━ One row per (place, guest), expired rows re-verify ━━━━━━━━━━━━━━━━━━━━━

update public.place_managers set verified_at = now() - interval '400 days', expires_at = now() - interval '35 days'
 where consumer_id = '00000000-0000-4000-8000-0000000a3103';

select lives_ok(
  $$select place_verification_approve('00000000-0000-4000-8000-000000003103',
      '00000000-0000-4000-8000-0000000a3103', 'phone_match', 365)$$,
  'an expired guest re-verifies without tripping the unique index'
);

select is(
  (select count(*)::int from public.place_managers
    where consumer_id = '00000000-0000-4000-8000-0000000a3103' and revoked_at is null
      and expires_at > now() and method = 'phone_match'),
  1,
  'the expired row is extended in place, not duplicated'
);

select throws_ok(
  $$insert into public.place_managers (place_id, consumer_id, method, expires_at)
    values ('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000a3103', 'review', now() + interval '1 day')$$,
  '23505', null,
  'a second unrevoked row for the same guest is refused'
);

-- ━━━ Send limits ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  array[
    place_take_verification_send('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000b3103', 'sms'),
    place_take_verification_send('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000b3103', 'call'),
    place_take_verification_send('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000b3103', 'sms')
  ],
  array['ok', 'ok', 'ok'],
  'three sends to a place in a day are allowed'
);

select is(
  place_take_verification_send('00000000-0000-4000-8000-000000003103', '00000000-0000-4000-8000-0000000a3103', 'sms'),
  'place_limit',
  'the fourth send to a place in 24 hours is refused'
);

select * from finish();
rollback;
