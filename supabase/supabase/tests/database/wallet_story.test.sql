-- MESITA-4484 — the voucher and the story are different tickets.
-- Paying writes the credit and no story row. story_detect creates one ticket
-- per mention and attaches it to the open Story voucher at the tagged
-- restaurant. The clock is the publication time: 3 hours, or 30 seconds for
-- an emulator mention while emulator mode is on. A delete frees the voucher
-- for another story. The bonus is written once. Other vouchers still pay
-- their bonus at credit.

begin;

create extension if not exists pgtap with schema public;

select plan(27);

create temp table cs (k text primary key, id uuid, handle text);
insert into cs values
  ('a', '00000000-0000-4000-8000-0000000a4484', 'story4484_a'),
  ('b', '00000000-0000-4000-8000-0000000b4484', 'story4484_b'),
  ('c', '00000000-0000-4000-8000-0000000c4484', 'story4484_c'),
  ('d', '00000000-0000-4000-8000-0000000d4484', 'story4484_d'),
  ('e', '00000000-0000-4000-8000-0000000e4484', 'story4484_e');
insert into auth.users (id) select id from cs;
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private)
select id, handle, now(), 1500, false from cs;
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014484', 'Story Probe One'),
  ('00000000-0000-4000-8000-000000024484', 'Story Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014484', 'mesita-4484-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024484', 'mesita-4484-probe-two', 'active', 'generating', 'MXN');

create temp table sp (k text primary key, id uuid default gen_random_uuid(), guest text, place text, voucher text);
insert into sp (k, guest, place, voucher) values
  ('a', 'a', '1', 'voucher_story'),
  ('b', 'b', '1', 'voucher_story'),
  ('c', 'c', '1', 'voucher_story'),
  ('d', 'd', '1', 'voucher_story'),
  ('e', 'e', '1', 'voucher_story'),
  ('std', 'a', '1', 'voucher_200');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode)
select sp.id, cs.id,
       '00000000-0000-4000-8000-000000014484'::uuid,
       10000, 'mxn', 'open', 'acct_test_4484', sp.voucher, 4000, 500, 'cs_test_4484' || sp.k, false
  from sp join cs on cs.k = sp.guest;

create temp table mm (k text primary key, id uuid);
create function pg_temp.post(k text, guest text, src text, age interval default interval '0') returns uuid
 language sql as $$
  insert into mm
  select k, (wallet_record_story_mention((select handle from cs where cs.k = guest), src, 'emu-4484-' || k, null, 'image',
                                         now() - age, false) ->> 'id')::uuid
  returning id;
$$;
create function pg_temp.story_for(k text) returns public.stories
 language sql as $$ select s.* from public.stories s where s.purchase_id = (select id from sp where sp.k = $1) and s.state <> 'void' $$;

select ok(
  not exists (
    select 1 from unnest(array[
      'public.story_detect(uuid, uuid)',
      'public.story_drop(uuid)',
      'public.story_create(uuid)',
      'public.story_settle(uuid, boolean, boolean)',
      'public.wallet_credit_purchase(uuid, text, timestamptz)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'the story RPCs stay service-role only'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stories'::regclass)
    and not has_table_privilege('anon', 'public.stories', 'SELECT'),
  'stories stays RLS-locked'
);

-- ━━━ Pay first: money now, no story ticket ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase((select id from sp where k = 'a'), 'pi_4484a', null) ->> 'story',
  'voucher_only',
  'paying does not create a story ticket'
);
select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select id from sp where k = 'a')),
  array['voucher:10000'],
  'the paid amount is Available at once and there is no bonus yet'
);
select is(
  (select count(*)::int from public.stories where purchase_id = (select id from sp where k = 'a')),
  0,
  'the voucher has no story row'
);
select is(
  wallet_credit_purchase((select id from sp where k = 'a'), 'pi_4484a', null) ->> 'outcome',
  'already_paid',
  'a second credit writes nothing'
);

select is(
  (select count(*)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'std') and kind = 'bonus'),
  0,
  'the other voucher has no bonus before it is credited'
);
select wallet_credit_purchase((select id from sp where k = 'std'), 'pi_4484std', now() + interval '3 hours');
select is(
  (select count(*)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'std') and kind = 'bonus'),
  1,
  'a non-story voucher still gets its bonus at credit'
);

-- ━━━ A detected story attaches; the clock starts at publication ━━━━━━━━━━━━━

select pg_temp.post('a', 'a', 'meta', interval '1 minute');
select is(
  story_detect((select id from mm where k = 'a'), '00000000-0000-4000-8000-000000014484') ->> 'outcome',
  'attached',
  'the story ticket attaches to the open voucher at that restaurant'
);
select is((pg_temp.story_for('a')).state, 'approved', 'attachment starts the bonus clock, with no waiter');
select is((pg_temp.story_for('a')).wait_sec, 10800, 'a real story waits 3 hours');
select ok(
  (pg_temp.story_for('a')).recheck_at = (select mentioned_at from public.story_mentions where id = (select id from mm where k = 'a')) + interval '3 hours',
  'the 3 hours run from publication, not from payment'
);
select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'),
  0,
  'the bonus waits until the story is still up'
);
select is(story_settle((pg_temp.story_for('a')).id, true, false) ->> 'outcome', 'released', 'a story still up pays the bonus');
select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'),
  1,
  'one bonus row'
);
select is(story_detect((select id from mm where k = 'a'), '00000000-0000-4000-8000-000000014484') ->> 'outcome', 'duplicate', 'the same event does not make a second ticket');
select is(story_settle((pg_temp.story_for('a')).id, true, false) ->> 'outcome', 'already_decided', 'a second settle pays nothing');
select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'),
  1,
  'still one bonus row'
);

-- ━━━ Delete, then another story, its own 30-second clock ━━━━━━━━━━━━━━━━━━━━━

select money_config_merge_story('{"story_emulator": true, "story_emulator_bonus_wait_sec": 30}'::jsonb);
select wallet_credit_purchase((select id from sp where k = 'b'), 'pi_4484b', null);
select pg_temp.post('b1', 'b', 'emulator', interval '0');
select is(
  (story_detect((select id from mm where k = 'b1'), '00000000-0000-4000-8000-000000014484') ->> 'wait_sec')::int,
  30,
  'an emulator story waits 30 seconds'
);
select ok(
  (pg_temp.story_for('b')).recheck_at = (select mentioned_at from public.story_mentions where id = (select id from mm where k = 'b1')) + interval '30 seconds',
  'those 30 seconds run from publication'
);
select is(story_drop((select id from mm where k = 'b1')) ->> 'reason', 'deleted', 'deleting the story voids that ticket');
select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'b') and kind = 'bonus'),
  0,
  'a deleted story pays nothing'
);
select pg_temp.post('b2', 'b', 'emulator', interval '5 seconds');
select is(
  story_detect((select id from mm where k = 'b2'), '00000000-0000-4000-8000-000000014484') ->> 'outcome',
  'attached',
  'the same voucher takes the next story without another purchase'
);
select ok(
  (select s.recheck_at = m.mentioned_at + interval '30 seconds' and s.mention_id = m.id
     from public.stories s
     join public.story_mentions m on m.id = s.mention_id
    where s.purchase_id = (select id from sp where k = 'b') and s.state = 'approved'),
  'the replacement story has its own clock'
);

-- ━━━ The restaurant tag is required to attach ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase((select id from sp where k = 'e'), 'pi_4484e', null);
select pg_temp.post('e', 'e', 'meta');
select is(
  story_detect((select id from mm where k = 'e'), '00000000-0000-4000-8000-000000024484') ->> 'outcome',
  'unattached',
  'a story tagged at another restaurant does not take this voucher'
);
select is(
  (select count(*)::int from public.stories where purchase_id = (select id from sp where k = 'e') and state <> 'void'),
  0,
  'the voucher is still open'
);

-- ━━━ A refund voids the open story ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase((select id from sp where k = 'd'), 'pi_4484d', null);
select pg_temp.post('d', 'd', 'meta');
select story_detect((select id from mm where k = 'd'), '00000000-0000-4000-8000-000000014484');
select wallet_refund_purchase((select id from sp where k = 'd'), 10000);
select is(
  (select void_reason from public.stories where purchase_id = (select id from sp where k = 'd')),
  'refunded',
  'a refund voids the open story'
);

select * from finish();
rollback;
