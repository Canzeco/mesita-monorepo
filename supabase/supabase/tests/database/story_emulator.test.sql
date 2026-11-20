-- MESITA-4426, MESITA-4484 — emulator mode. The merge RPC still clamps the
-- test waits. A test story's bonus clock is 30 seconds from publication; a
-- live purchase and a Meta story keep 3 hours. The poll settles a due test
-- story and never a Meta one. story_expire_one still ends a legacy row whose
-- deadline has passed; a new ticket's deadline is infinity, so it does not.

begin;

create extension if not exists pgtap with schema public;

select plan(17);

create temp table cs (k text primary key, id uuid, handle text);
insert into cs values
  ('a', '00000000-0000-4000-8000-0000000a4426', 'emu4426_a'),
  ('b', '00000000-0000-4000-8000-0000000b4426', 'emu4426_b'),
  ('c', '00000000-0000-4000-8000-0000000c4426', 'emu4426_c'),
  ('d', '00000000-0000-4000-8000-0000000d4426', 'emu4426_d');
insert into auth.users (id) select id from cs;
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private)
select id, handle, now(), 1500, false from cs;
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014426', 'Emulator Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014426', 'mesita-4426-probe', 'active', 'generating', 'MXN');
create temp table sp (k text primary key, id uuid default gen_random_uuid(), guest text, live boolean);
insert into sp (k, guest, live) values ('a', 'a', false), ('b', 'b', false), ('c', 'c', true), ('d', 'd', false);
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode)
select sp.id, cs.id, '00000000-0000-4000-8000-000000014426', 10000, 'mxn', 'open', 'acct_test_4426', 'voucher_story', 5000, 500,
       'cs_test_4426' || sp.k, sp.live
  from sp join cs on cs.k = sp.guest;
create temp table mm (k text primary key, id uuid);
create function pg_temp.post(k text, guest text, src text, live boolean default false) returns uuid
 language sql as $$
  insert into mm
  select k, (wallet_record_story_mention((select handle from cs where cs.k = guest), src, 'emu-4426-' || k, null, 'image',
                                         now(), live) ->> 'id')::uuid
  returning id;
$$;
create function pg_temp.story(k text) returns public.stories
 language sql as $$ select s.* from public.stories s where s.purchase_id = (select id from sp where sp.k = $1) and s.state <> 'void' $$;

select is(
  (money_config_merge_story('{"story_emulator": true, "story_emulator_bonus_wait_sec": 5, "story_emulator_post_window_sec": 99999}'::jsonb) -> 'after')
    - array['story_min_followers', 'story_bonus_wait_sec', 'story_post_window_sec', 'story_credit_margin_sec', 'story_check_margin_sec', 'story_recheck_meta'],
  '{"story_emulator": true, "story_emulator_bonus_wait_sec": 10, "story_emulator_post_window_sec": 3600}'::jsonb,
  'the switch lands; the waits clamp to 10 s and 3,600 s');
select throws_ok($$ select money_config_merge_story('{"story_emulator": "yes"}'::jsonb) $$, '22023', null, 'the switch must be a boolean');
select throws_ok($$ select money_config_merge_story('{"story_emulator_bonus_wait_sec": 30.5}'::jsonb) $$, '22023', null, 'a fractional wait is refused');
select lives_ok($$ select money_config_merge_story('{"story_emulator_bonus_wait_sec": 30, "story_emulator_post_window_sec": 120}'::jsonb) $$, 'the defaults save');
select is(story_emulator_on(), true, 'the switch reads on');

select is(wallet_credit_purchase((select id from sp where k = 'a'), 'pi_test_4426a', null) ->> 'story', 'voucher_only', 'the credit creates no story ticket');
select pg_temp.post('a', 'a', 'emulator');
select is(
  story_detect((select id from mm where k = 'a'), '00000000-0000-4000-8000-000000014426') ->> 'outcome',
  'attached',
  'the test story attaches on its own'
);
select is((pg_temp.story('a')).wait_sec, 30, 'the test story was given 30 seconds');
select ok(
  (pg_temp.story('a')).recheck_at > now() + interval '20 seconds',
  'the poll is not due in the first moments'
);
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'not_due', 'before the wait, the poll settles nothing');
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('a')).id;
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'released', 'once due, the poll releases the bonus');
select is((select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'), 1, 'one bonus row');
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'not_due', 'a second poll changes nothing');

select wallet_credit_purchase((select id from sp where k = 'c'), 'pi_live_4426c', null);
select pg_temp.post('c', 'c', 'emulator', true);
select story_detect((select id from mm where k = 'c'), '00000000-0000-4000-8000-000000014426');
select is((pg_temp.story('c')).wait_sec, 10800, 'a live story keeps the 3 hour wait with the switch on');

select wallet_credit_purchase((select id from sp where k = 'd'), 'pi_test_4426d', null);
select pg_temp.post('d', 'd', 'meta');
select story_detect((select id from mm where k = 'd'), '00000000-0000-4000-8000-000000014426');
select is((pg_temp.story('d')).wait_sec, 10800, 'a Meta story keeps the 3 hour wait with the switch on');
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('d')).id;
select is(story_settle_emulated_due((pg_temp.story('d')).id) ->> 'outcome', 'not_due', 'the poll never settles a Meta story');

select is(story_expire_one((pg_temp.story('c')).id) ->> 'outcome', 'not_due', 'a publication ticket has no post deadline');

select * from finish();
rollback;
