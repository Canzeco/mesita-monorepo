-- MESITA-4426 — Stories emulator mode. With money_config.story_emulator on, a
-- TEST-mode Story gets the emulator's post window, and a story from the
-- emulator gets the emulator's bonus wait; real money (livemode) and Meta
-- stories never do. The Story keeps what it was given. The screen's poll
-- settles a due test Story (story_settle_emulated_due) and expires a
-- past-deadline one (story_expire_one); anything else is not_due. The merge
-- RPC takes the emulator keys, typed and clamped.

begin;

create extension if not exists pgtap with schema public;

select plan(30);

-- ━━━ Fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table cs (k text primary key, id uuid, handle text);
insert into cs values
  ('a', '00000000-0000-4000-8000-0000000a4426', 'emu4426_a'),
  ('b', '00000000-0000-4000-8000-0000000b4426', 'emu4426_b'),
  ('c', '00000000-0000-4000-8000-0000000c4426', 'emu4426_c'),
  ('d', '00000000-0000-4000-8000-0000000d4426', 'emu4426_d'),
  ('e', '00000000-0000-4000-8000-0000000e4426', 'emu4426_e');
insert into auth.users (id) select id from cs;
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private)
select id, handle, now(), 10, true from cs;
insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014426', 'Emulator Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014426', 'mesita-4426-probe', 'active', 'generating', 'MXN');
create temp table sp (k text primary key, id uuid default gen_random_uuid(), guest text, live boolean);
insert into sp (k, guest, live) values ('a', 'a', false), ('b', 'b', false), ('c', 'c', true), ('d', 'd', false), ('e', 'e', false);
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
                                         now() - interval '1 minute', live) ->> 'id')::uuid
  returning id;
$$;
create function pg_temp.story(k text) returns public.stories
 language sql as $$ select s.* from public.stories s where s.purchase_id = (select id from sp where sp.k = $1) $$;
create function pg_temp.token(k text) returns text
 language sql as $$ select review_token from public.story_mentions where id = (select id from mm where mm.k = $1) $$;
create function pg_temp.approve(k text) returns jsonb
 language sql as $$
  select story_bind((pg_temp.story(k)).id);
  select story_review(pg_temp.token(k), '00000000-0000-4000-8000-000000014426', true, 'dev_4426');
$$;

select ok(
  not exists (
    select 1 from unnest(array[
      'public.story_emulator_on()', 'public.story_post_window_for(boolean)', 'public.story_wait_for(boolean, uuid)',
      'public.story_settle_emulated_due(uuid)', 'public.story_expire_one(uuid)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'every emulator RPC is service-role only');

-- ━━━ The merge RPC takes the emulator keys ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
select is(
  (money_config_merge_story('{"story_emulator": true, "story_emulator_bonus_wait_sec": 5, "story_emulator_post_window_sec": 99999}'::jsonb) -> 'after')
    - array['story_min_followers', 'story_bonus_wait_sec', 'story_post_window_sec', 'story_credit_margin_sec', 'story_check_margin_sec', 'story_recheck_meta'],
  '{"story_emulator": true, "story_emulator_bonus_wait_sec": 10, "story_emulator_post_window_sec": 3600}'::jsonb,
  'the switch lands; the waits clamp to 10 s and 3,600 s');
select throws_ok($$ select money_config_merge_story('{"story_emulator": "yes"}'::jsonb) $$, '22023', null, 'the switch must be a boolean');
select throws_ok($$ select money_config_merge_story('{"story_emulator_bonus_wait_sec": 30.5}'::jsonb) $$, '22023', null, 'a fractional wait is refused');
select lives_ok($$ select money_config_merge_story('{"story_emulator_bonus_wait_sec": 30, "story_emulator_post_window_sec": 120}'::jsonb) $$, 'the defaults save');

-- ━━━ Switch on, test mode, emulator story: 120 s to post, 30 s wait ━━━━━━━━━━
select is(story_emulator_on(), true, 'the switch reads on');
select is(story_post_window_for(false), interval '120 seconds', 'a test Story gets the emulator window');
select is(story_post_window_for(true), interval '12 hours', 'a live Story never does');
select is(wallet_credit_purchase((select id from sp where k = 'a'), 'pi_test_4426a', null) ->> 'story', 'waiting_post', 'the credit creates Story a');
select ok((pg_temp.story('a')).deadline_at <= now() + interval '121 seconds', 'Story a has a two-minute deadline');
select pg_temp.post('a', 'a', 'emulator');
select is(pg_temp.approve('a') ->> 'outcome', 'approved', 'the waiter approves Story a');
select is((pg_temp.story('a')).wait_sec, 30, 'Story a was given the 30 s wait');
select ok((pg_temp.story('a')).recheck_at <= now() + interval '31 seconds', 'its re-check is 30 s after approval');

-- ━━━ The poll's settle: not before it is due ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'not_due', 'before the wait, the poll settles nothing');
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('a')).id;
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'released', 'once due, the poll releases the bonus');
select is((select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'), 1, 'one bonus row');
select is(story_settle_emulated_due((pg_temp.story('a')).id) ->> 'outcome', 'not_due', 'a second poll changes nothing');
select is(story_settle((pg_temp.story('a')).id, true, false) ->> 'outcome', 'already_decided', 'the cron after it changes nothing');
select is((select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'), 1, 'still one bonus row');

-- ━━━ A deleted test story voids, no bonus ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
select wallet_credit_purchase((select id from sp where k = 'b'), 'pi_test_4426b', null);
select pg_temp.post('b', 'b', 'emulator');
select pg_temp.approve('b');
update public.story_mentions set deleted_at = now() where id = (select id from mm where k = 'b');
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('b')).id;
select is(story_settle_emulated_due((pg_temp.story('b')).id) ->> 'reason', 'deleted', 'a deleted test story voids (deleted)');
select is((select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'b') and kind = 'bonus'), 0, 'no bonus for it');

-- ━━━ Real money and Meta stories keep the real rules ━━━━━━━━━━━━━━━━━━━━━━━━━
select wallet_credit_purchase((select id from sp where k = 'c'), 'pi_live_4426c', null);
select ok((pg_temp.story('c')).deadline_at > now() + interval '11 hours', 'a livemode Story keeps the 12 h window with the switch on');
select wallet_credit_purchase((select id from sp where k = 'd'), 'pi_test_4426d', null);
select pg_temp.post('d', 'd', 'meta');
select pg_temp.approve('d');
select is((pg_temp.story('d')).wait_sec, 10800, 'a Meta story keeps the 3 h wait with the switch on');
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('d')).id;
select is(story_settle_emulated_due((pg_temp.story('d')).id) ->> 'outcome', 'not_due', 'the poll never settles a Meta story');

-- ━━━ Switch off: an approved test Story is left to the cron ━━━━━━━━━━━━━━━━━━
select wallet_credit_purchase((select id from sp where k = 'e'), 'pi_test_4426e', null);
select pg_temp.post('e', 'e', 'emulator');
select pg_temp.approve('e');
select money_config_merge_story('{"story_emulator": false}'::jsonb);
update public.stories set recheck_at = now() - interval '1 second' where id = (pg_temp.story('e')).id;
select is(story_settle_emulated_due((pg_temp.story('e')).id) ->> 'outcome', 'not_due', 'switched off, the poll settles nothing');
select is(story_settle((pg_temp.story('e')).id, true, false) ->> 'outcome', 'released', 'the cron still settles it');
select is(story_post_window_for(false), interval '12 hours', 'switched off, test Stories get 12 h again');

-- ━━━ story_expire_one ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
update public.stories set state = 'waiting_post', mention_id = null, deadline_at = now() + interval '1 minute', decided_at = null
 where id = (pg_temp.story('c')).id;
select is(story_expire_one((pg_temp.story('c')).id) ->> 'outcome', 'not_due', 'before the deadline nothing expires');
update public.stories set deadline_at = now() - interval '1 second' where id = (pg_temp.story('c')).id;
select is(story_expire_one((pg_temp.story('c')).id) ->> 'outcome', 'expired', 'past the deadline the Story expires');
select ok(
  (pg_temp.story('c')).void_reason = 'expired'
    and (select status from public.wallet_purchases where id = (select id from sp where k = 'c')) = 'paid',
  'void expired, and the purchase stays paid: the credit is kept');

select * from finish();
rollback;
