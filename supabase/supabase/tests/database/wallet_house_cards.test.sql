-- MESITA-3582 — a guest pins a place's House Card to their Wallet.
-- The table is EF-only: anon and authenticated can neither read nor write
-- it (a guest must not see or plant another guest's pins); one row per
-- guest and place; deleting the guest or the place takes the pin with it.

begin;

create extension if not exists pgtap with schema public;

select plan(9);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3582'),
  ('00000000-0000-4000-8000-0000000b3582');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a3582'),
  ('00000000-0000-4000-8000-0000000b3582');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000013582', 'House Card Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000013582', 'mesita-3582-house-card-probe', 'active', 'generating', 'MXN');

-- ━━━ Access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  (select relrowsecurity from pg_class where oid = 'public.wallet_house_cards'::regclass),
  'wallet_house_cards has row level security on'
);
select ok(
  not has_table_privilege('anon', 'public.wallet_house_cards', 'SELECT')
  and not has_table_privilege('anon', 'public.wallet_house_cards', 'INSERT')
  and not has_table_privilege('anon', 'public.wallet_house_cards', 'DELETE'),
  'anon can neither read, add nor remove a pin'
);
select ok(
  not has_table_privilege('authenticated', 'public.wallet_house_cards', 'SELECT')
  and not has_table_privilege('authenticated', 'public.wallet_house_cards', 'INSERT')
  and not has_table_privilege('authenticated', 'public.wallet_house_cards', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.wallet_house_cards', 'DELETE'),
  'a signed-in guest goes through the EFs, never the table'
);

-- ━━━ One pin per guest and place ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_house_cards (consumer_id, place_id)
values ('00000000-0000-4000-8000-0000000a3582', '00000000-0000-4000-8000-000000013582');

select throws_ok(
  $$insert into public.wallet_house_cards (consumer_id, place_id)
    values ('00000000-0000-4000-8000-0000000a3582', '00000000-0000-4000-8000-000000013582')$$,
  '23505', null,
  'the same guest cannot pin the same place twice'
);
select lives_ok(
  $$insert into public.wallet_house_cards (consumer_id, place_id)
    values ('00000000-0000-4000-8000-0000000b3582', '00000000-0000-4000-8000-000000013582')$$,
  'another guest pins the same place'
);
select is(
  (select count(*)::int from public.wallet_house_cards where place_id = '00000000-0000-4000-8000-000000013582'),
  2,
  'two guests, two pins'
);
select throws_ok(
  $$insert into public.wallet_house_cards (consumer_id, place_id)
    values ('00000000-0000-4000-8000-0000000a3582', '00000000-0000-4000-8000-0000000f3582')$$,
  '23503', null,
  'a pin names a real place'
);

-- ━━━ Cascades ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

delete from public.consumers where id = '00000000-0000-4000-8000-0000000b3582';
select is(
  (select count(*)::int from public.wallet_house_cards where consumer_id = '00000000-0000-4000-8000-0000000b3582'),
  0,
  'a deleted guest takes their pins with them'
);
delete from public.places where id = '00000000-0000-4000-8000-000000013582';
select is(
  (select count(*)::int from public.wallet_house_cards where place_id = '00000000-0000-4000-8000-000000013582'),
  0,
  'a deleted place takes its pins with it'
);

select * from finish();
rollback;
