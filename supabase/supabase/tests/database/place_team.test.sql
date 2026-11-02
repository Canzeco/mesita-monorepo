-- MESITA-3120 — a place's team: one owner, editors, invites, transfer.

begin;

create extension if not exists pgtap with schema public;

select plan(9);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3120'),
  ('00000000-0000-4000-8000-0000000b3120'),
  ('00000000-0000-4000-8000-0000000c3120');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3120'),
  ('00000000-0000-4000-8000-0000000b3120'),
  ('00000000-0000-4000-8000-0000000c3120');
insert into public.place_profiles (id, google_name)
values ('00000000-0000-4000-8000-000000003120', 'Team Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000003120', 'mesita-3120-probe', 'active', 'generating', 'MXN');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.place_invites'::regclass)
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'place_invites')
    and not has_table_privilege('authenticated', 'public.place_invites', 'SELECT')
    and not has_function_privilege('authenticated', 'public.place_invite_accept(text, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_transfer_owner(uuid, uuid)', 'EXECUTE'),
  'invites are EF-only and the team RPCs are service-role only'
);

-- The first approved claim is the owner; the next one joins as an editor.
select place_verification_approve('00000000-0000-4000-8000-000000003120', '00000000-0000-4000-8000-0000000a3120', 'review', 365);
select place_verification_approve('00000000-0000-4000-8000-000000003120', '00000000-0000-4000-8000-0000000b3120', 'review', 365);

select is(
  (select role from public.place_managers where consumer_id = '00000000-0000-4000-8000-0000000a3120' and revoked_at is null),
  'owner', 'the first approved claim becomes the owner'
);
select is(
  (select role from public.place_managers where consumer_id = '00000000-0000-4000-8000-0000000b3120' and revoked_at is null),
  'editor', 'a later approved claim joins as an editor'
);

select throws_ok(
  $$update public.place_managers set role = 'owner' where consumer_id = '00000000-0000-4000-8000-0000000b3120'$$,
  '23505', null,
  'a place has one owner'
);

-- An invite lands as an editor when that email signs in, once.
insert into public.place_invites (place_id, email, invited_by)
values ('00000000-0000-4000-8000-000000003120', 'cook@example.com', '00000000-0000-4000-8000-0000000a3120');

select is(place_invite_accept(' Cook@Example.com ', '00000000-0000-4000-8000-0000000c3120'), 1, 'the invited email takes its invite');
select is(
  (select role || '/' || method from public.place_managers where consumer_id = '00000000-0000-4000-8000-0000000c3120' and revoked_at is null),
  'editor/invite', 'an accepted invite is an editor row'
);
select is(place_invite_accept('cook@example.com', '00000000-0000-4000-8000-0000000c3120'), 0, 'a spent invite is not taken twice');

-- Transfer: the owner hands the place to an editor; the old owner stays an editor.
select ok(
  place_transfer_owner('00000000-0000-4000-8000-000000003120',
    (select id from public.place_managers where consumer_id = '00000000-0000-4000-8000-0000000b3120' and revoked_at is null)),
  'the owner can hand the place to an editor'
);
select is(
  (select string_agg(role, ',' order by consumer_id) from public.place_managers
    where place_id = '00000000-0000-4000-8000-000000003120' and revoked_at is null),
  'editor,owner,editor', 'after a transfer there is still exactly one owner'
);

select * from finish();
rollback;
