-- MESITA-4405 — the Story is a record of its own; the Story voucher is money.
-- The credit writes the paid amount Available at once and creates one Story
-- (waiting_post, deadline = paid_at + post window); story_bind ties the
-- guest's newest fitting story (found); a waiter of the place approves
-- (approved, re-check = approval + bonus wait) or rejects it (rejected at
-- that place only, the Story waits for a new post); the re-check releases
-- the bonus exactly once or voids it (deleted, unreachable); the deadline
-- voids a Story not yet approved (expired); a refund voids an open Story;
-- the operator releases or voids; the old function names still answer for
-- the deploy window; the data move maps the purchase columns; nobody but
-- the EFs calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(79);

-- ━━━ Fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create temp table cs (k text primary key, id uuid, handle text);
insert into cs values
  ('a', '00000000-0000-4000-8000-0000000a4405', 'story4405_a'),
  ('b', '00000000-0000-4000-8000-0000000b4405', 'story4405_b'),
  ('c', '00000000-0000-4000-8000-0000000c4405', 'story4405_c'),
  ('d', '00000000-0000-4000-8000-0000000d4405', 'story4405_d'),
  ('e', '00000000-0000-4000-8000-0000000e4405', 'story4405_e'),
  ('f', '00000000-0000-4000-8000-0000000f4405', 'story4405_f'),
  ('g', '00000000-0000-4000-8000-0000001a4405', 'story4405_g'),
  ('h', '00000000-0000-4000-8000-0000001b4405', 'story4405_h'),
  ('o', '00000000-0000-4000-8000-0000001c4405', 'story4405_o');
insert into auth.users (id) select id from cs;
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private)
select id, handle, now(), 5000, false from cs;
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014405', 'Story Probe One'),
  ('00000000-0000-4000-8000-000000024405', 'Story Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014405', 'mesita-4405-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024405', 'mesita-4405-probe-two', 'active', 'generating', 'MXN');

-- Story purchases by key: (guest, place one | two).
create temp table sp (k text primary key, id uuid default gen_random_uuid(), guest text, place text);
insert into sp (k, guest, place) values
  ('a', 'a', '1'), ('b', 'b', '1'), ('b2', 'b', '2'), ('c', 'c', '1'),
  ('d1', 'd', '1'), ('d2', 'd', '1'), ('d3', 'd', '1'),
  ('e1', 'e', '1'), ('e2', 'e', '1'),
  ('f1', 'f', '1'), ('f2', 'f', '1'), ('f3', 'f', '1'),
  ('g1', 'g', '1'), ('g2', 'g', '1'), ('g3', 'g', '1'), ('g4', 'g', '1'),
  ('h1', 'h', '1'), ('h2', 'h', '1');
insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode)
select sp.id, cs.id,
       case sp.place when '1' then '00000000-0000-4000-8000-000000014405'::uuid else '00000000-0000-4000-8000-000000024405'::uuid end,
       10000, 'mxn', 'open', 'acct_test_4405', 'voucher_story', 5000, 500, 'cs_test_4405' || sp.k, false
  from sp join cs on cs.k = sp.guest;

-- Mentions by key, posted `age` ago under a guest's handle.
create temp table mm (k text primary key, id uuid);
create function pg_temp.post(k text, guest text, age interval, live boolean default false) returns uuid
 language sql as $$
  insert into mm
  select k, (wallet_record_story_mention((select handle from cs where cs.k = guest), 'emulator', 'emu-4405-' || k, null, 'image',
                                         now() - age, live) ->> 'id')::uuid
  returning id;
$$;
create function pg_temp.story(k text) returns public.stories
 language sql as $$ select s.* from public.stories s where s.purchase_id = (select id from sp where sp.k = $1) $$;
create function pg_temp.token(k text) returns text
 language sql as $$ select review_token from public.story_mentions where id = (select id from mm where mm.k = $1) $$;

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (
    select 1 from unnest(array[
      'public.wallet_record_story_mention(text, text, text, text, text, timestamptz, boolean, text)',
      'public.wallet_settle_story_recheck(uuid, boolean)',
      'public.wallet_override_story(uuid, text, uuid)',
      'public.story_claim(uuid)',
      'public.story_create(uuid)',
      'public.story_bind(uuid, uuid, boolean)',
      'public.story_bind_handle(uuid)',
      'public.story_settle(uuid, boolean, boolean)',
      'public.story_expire_sweep(integer)',
      'public.stories_move_legacy()',
      'public.wallet_purge_story_mentions(timestamptz)',
      'public.wallet_credit_purchase(uuid, text, timestamptz)',
      'public.wallet_refund_purchase(uuid, integer, text)',
      'public.story_rules()',
      'public.story_review_open(uuid, uuid)',
      'public.story_review(text, uuid, boolean, text)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'every Story RPC is service-role only'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stories'::regclass)
    and not has_table_privilege('anon', 'public.stories', 'SELECT')
    and not has_table_privilege('authenticated', 'public.stories', 'SELECT'),
  'stories is RLS-locked and EF-only'
);

-- ━━━ The rules: post_window ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is((select post_window from story_rules()), interval '12 hours', 'the post window defaults to 12 hours');
update public.app_config set money_config = money_config || '{"story_post_window_sec": 60}' where id = 1;
select is((select post_window from story_rules()), interval '2 hours', 'a window under 2 hours reads 2 hours');
update public.app_config set money_config = money_config || '{"story_post_window_sec": 999999}' where id = 1;
select is((select post_window from story_rules()), interval '24 hours', 'a window over 24 hours reads 24 hours');
update public.app_config set money_config = money_config || '{"story_post_window_sec": 43200}' where id = 1;

-- ━━━ Pay first: the money now, the Story with it ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase((select id from sp where k = 'a'), 'pi_test_4405a', null) ->> 'story',
  'waiting_post',
  'the credit creates the Story, waiting for the post'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select id from sp where k = 'a') and available_at <= now()),
  array['voucher:10000'],
  'what the guest paid is Available at once; no bonus entry yet'
);

select ok(
  (select s.deadline_at = p.paid_at + interval '12 hours' and s.bonus_cents = 5000 and s.mention_id is null
          and s.first_bound_at is null and s.consumer_id = p.consumer_id and s.livemode = false
     from public.wallet_purchases p join public.stories s on s.purchase_id = p.id
    where p.id = (select id from sp where k = 'a')),
  'the deadline is payment + the post window'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'a'), 'pi_test_4405a', null) ->> 'outcome',
  'already_paid',
  'a second webhook credits nothing'
);

select is(
  (select count(*)::int from public.stories where purchase_id = (select id from sp where k = 'a')),
  1,
  'one Story per purchase'
);

select throws_ok(
  $$update public.stories set state = 'found' where purchase_id = (select id from sp where k = 'a')$$,
  '23514', null,
  'found needs a story'
);

-- ━━━ Bind: waiting_post → found ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  story_bind((pg_temp.story('a')).id) ->> 'outcome',
  'nothing_yet',
  'no story yet: nothing to bind, no error'
);

select pg_temp.post('a_old', 'a', interval '20 hours');
select pg_temp.post('a_live', 'a', interval '5 minutes', true);

select is(
  story_bind((pg_temp.story('a')).id) ->> 'outcome',
  'nothing_yet',
  'a story too old to outlive the re-check, or of the other mode, never binds'
);

select pg_temp.post('a1', 'a', interval '30 minutes');
select pg_temp.post('a2', 'a', interval '5 minutes');

select is(
  story_bind((pg_temp.story('a')).id) ->> 'mention_id',
  (select id::text from mm where k = 'a2'),
  'the newest fitting story binds'
);

select ok(
  (select s.state = 'found' and s.first_bound_at = now() from pg_temp.story('a') s)
    and (select review_place_id = '00000000-0000-4000-8000-000000014405' and review is null
                and review_token ~ '^[0-9a-f]{32}$'
           from public.story_mentions where id = (select id from mm where k = 'a2')),
  'found: the story points at the place with a QR token and no decision'
);

select is(
  story_bind((pg_temp.story('a')).id) ->> 'outcome',
  'unchanged',
  'a found Story does not bind again'
);

-- ━━━ The waiter ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  story_review(pg_temp.token('a2'), '00000000-0000-4000-8000-000000024405', true, 'dev_a') ->> 'code',
  'wrong_place',
  'a waiter of another place cannot approve it'
);

select is(
  story_review('0123456789abcdef0123456789abcdef', '00000000-0000-4000-8000-000000014405', true, 'dev_a') ->> 'code',
  'gone',
  'an unknown token is gone'
);

select is(
  story_review(pg_temp.token('a2'), '00000000-0000-4000-8000-000000014405', true, 'dev_a') ->> 'outcome',
  'approved',
  'the waiter of the place approves it'
);

select ok(
  (select s.state = 'approved' and s.approved_at = now() and s.approved_device_hash = 'dev_a'
          and s.recheck_at = now() + interval '3 hours' and s.recheck_tries = 0
     from pg_temp.story('a') s),
  'approved: the re-check is approval + 3 hours, the phone kept as a hash'
);

select is(
  story_review(pg_temp.token('a2'), '00000000-0000-4000-8000-000000014405', true, 'dev_a') ->> 'outcome',
  'already_approved',
  'a second approve answers the stored approval'
);

select is(
  story_review(pg_temp.token('a2'), '00000000-0000-4000-8000-000000014405', false, 'dev_a') ->> 'code',
  'already_decided',
  'an approved story cannot be rejected after'
);

select is(
  story_settle(gen_random_uuid(), true) ->> 'code',
  'not_found',
  'no such Story'
);

-- ━━━ Reject at one place, post again; the reject does not travel ━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4405' || k, null) from sp where k in ('b', 'b2');
select pg_temp.post('b1', 'b', interval '5 minutes');

select is(
  story_bind_handle((select id from mm where k = 'b1')) ->> 'outcome',
  'several_open',
  'with two open Stories the webhook leaves the bind to the guest''s screen'
);

select is(
  story_bind((pg_temp.story('b')).id) ->> 'outcome',
  'found',
  'the guest''s screen binds it'
);

select is(
  story_review(pg_temp.token('b1'), '00000000-0000-4000-8000-000000014405', false, 'dev_b') ->> 'outcome',
  'rejected',
  'the waiter rejects it'
);

select ok(
  (select s.state = 'waiting_post' and s.mention_id is null and s.first_bound_at is not null from pg_temp.story('b') s)
    and (select review = 'rejected' from public.story_mentions where id = (select id from mm where k = 'b1')),
  'a reject unbinds the story and the Story waits for a new post'
);

select is(
  story_review(pg_temp.token('b1'), '00000000-0000-4000-8000-000000014405', false, 'dev_b') ->> 'outcome',
  'already_rejected',
  'a repeat reject answers the stored one'
);

select is(
  story_bind((pg_temp.story('b')).id) ->> 'outcome',
  'nothing_yet',
  'a story rejected at this place never binds here again'
);

select is(
  story_bind((pg_temp.story('b2')).id, (select id from mm where k = 'b1')) ->> 'outcome',
  'found',
  'the same story binds at another place (a reject is per place)'
);

select ok(
  (select review is null and review_place_id = '00000000-0000-4000-8000-000000024405'
     from public.story_mentions where id = (select id from mm where k = 'b1')),
  'and the decision is cleared there'
);

select pg_temp.post('b3', 'b', interval '1 minute');
select is(
  story_bind((pg_temp.story('b')).id) ->> 'mention_id',
  (select id::text from mm where k = 'b3'),
  'a new post binds'
);

select isnt(pg_temp.token('b3'), pg_temp.token('b1'), 'a new story has a new token');

select is(
  story_review(pg_temp.token('b3'), '00000000-0000-4000-8000-000000014405', true, 'dev_b') ->> 'outcome',
  'approved',
  'and is approved'
);

-- ━━━ Too old at approval ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase((select id from sp where k = 'c'), 'pi_test_4405c', null);
select pg_temp.post('c1', 'c', interval '19 hours');
select story_bind((pg_temp.story('c')).id);
update public.story_mentions set mentioned_at = now() - interval '21 hours' where id = (select id from mm where k = 'c1');

select is(
  story_review(pg_temp.token('c1'), '00000000-0000-4000-8000-000000014405', true, 'dev_c') ->> 'code',
  'story_too_old',
  'a story that would end before the re-check cannot be approved'
);

select is((pg_temp.story('c')).state, 'found', 'and the Story stays found');

-- ━━━ The deadline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4405' || k, null) from sp where k in ('d1', 'd2', 'd3');
select pg_temp.post('d1', 'd', interval '10 minutes');
select pg_temp.post('d2', 'd', interval '5 minutes');
select story_bind((pg_temp.story('d1')).id, (select id from mm where k = 'd1'));
select story_bind((pg_temp.story('d2')).id, (select id from mm where k = 'd2'));
select story_review(pg_temp.token('d2'), '00000000-0000-4000-8000-000000014405', true, 'dev_d');
update public.stories set deadline_at = now() - interval '1 minute'
 where purchase_id in (select id from sp where k in ('d1', 'd2', 'd3'));

select is(
  story_review(pg_temp.token('d1'), '00000000-0000-4000-8000-000000014405', true, 'dev_d') ->> 'code',
  'gone',
  'an approval after the deadline is refused'
);

select is(
  story_bind((pg_temp.story('d3')).id) ->> 'outcome',
  'past_deadline',
  'the screen never binds past the deadline'
);

create temp table swept as select * from story_expire_sweep(100);

select is(
  (select array_agg(s.k || ':' || w.was_bound order by s.k) from swept w join sp s on s.id = w.purchase_id),
  array['d1:true', 'd3:false'],
  'the sweep expires the found and the never-posted Story, and says which had a story'
);

select ok(
  (select bool_and(state = 'void' and void_reason = 'expired' and decided_at = now())
     from public.stories where purchase_id in (select id from sp where k in ('d1', 'd3'))),
  'both read void expired'
);

select is((pg_temp.story('d2')).state, 'approved', 'an approved Story outlives its deadline');

select is((select count(*)::int from story_expire_sweep(100)), 0, 'a second sweep does nothing');

-- ━━━ Binding races ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4405' || k, null) from sp where k in ('e1', 'e2');
select pg_temp.post('e1', 'e', interval '5 minutes');
select story_bind((pg_temp.story('e1')).id);

select is(
  story_bind((pg_temp.story('e2')).id) ->> 'outcome',
  'nothing_yet',
  'a story another Story holds is not bound twice'
);

select throws_ok(
  $$update public.stories set state = 'found', mention_id = (select id from mm where k = 'e1'), first_bound_at = now()
     where purchase_id = (select id from sp where k = 'e2')$$,
  '23505', null,
  'one Story per story, enforced by the table'
);

-- ━━━ The webhook's bind ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4405' || k, null) from sp where k in ('f1', 'f2', 'f3');
select pg_temp.post('f1', 'f', interval '5 minutes');

select is(
  story_bind_handle((select id from mm where k = 'f1')) ->> 'outcome',
  'several_open',
  'three open Stories: no auto-bind'
);
select story_bind((pg_temp.story('f2')).id);
select pg_temp.post('f2', 'f', interval '4 minutes');
select story_bind((pg_temp.story('f3')).id);
select pg_temp.post('f3', 'f', interval '3 minutes');

select is(
  story_bind_handle((select id from mm where k = 'f3')) ->> 'outcome',
  'found',
  'with exactly one open Story the webhook binds the new story to it'
);

select is(
  (pg_temp.story('f1')).mention_id,
  (select id from mm where k = 'f3'),
  'to that Story'
);

-- ━━━ The re-check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  story_settle((pg_temp.story('c')).id, true) ->> 'code',
  'not_approved',
  'a Story not approved is not settled'
);

select is(
  story_settle((pg_temp.story('a')).id, true) ->> 'outcome',
  'released',
  'a story still up releases the bonus'
);

select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'),
  5000,
  'the bonus entry is written'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'a'), true) ->> 'outcome',
  'already_decided',
  'the old re-check call forwards to the Story and writes nothing more'
);

select is(
  wallet_override_story((select id from sp where k = 'a'), 'release') ->> 'outcome',
  'already_released',
  'nor does the operator''s release'
);

select is(
  (select count(*)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'a') and kind = 'bonus'),
  1,
  'one bonus row per purchase across every path'
);

-- f1 (bound f3), f2 (bound f1), f3 (bound f2): approve all three.
select story_review(m.review_token, '00000000-0000-4000-8000-000000014405', true, 'dev_f')
  from public.stories s join public.story_mentions m on m.id = s.mention_id
 where s.purchase_id in (select id from sp where k in ('f1', 'f2', 'f3'));

select is(
  story_settle((pg_temp.story('f1')).id, false) ->> 'outcome',
  'retry',
  'a first failure retries'
);
select story_settle((pg_temp.story('f1')).id, false);

select is(
  story_settle((pg_temp.story('f1')).id, false) ->> 'reason',
  'unreachable',
  'the third failure voids the bonus (unreachable)'
);

select is(
  story_settle((pg_temp.story('f2')).id, false, true) ->> 'reason',
  'deleted',
  'a deleted test story voids it at once (deleted)'
);

update public.story_mentions set mentioned_at = now() - interval '25 hours'
 where id = (select mention_id from pg_temp.story('f3'));

select is(
  wallet_settle_story_recheck((select id from sp where k = 'f3'), false) ->> 'natural_end',
  'true',
  'a story past its own 24 hours ended on its own: released (through the old call)'
);

-- ━━━ Refunds in every state ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4405' || k, null) from sp where k in ('g1', 'g2', 'g3', 'g4');
select pg_temp.post('g2', 'g', interval '6 minutes');
select story_bind((pg_temp.story('g2')).id, (select id from mm where k = 'g2'));
select pg_temp.post('g3', 'g', interval '5 minutes');
select story_bind((pg_temp.story('g3')).id, (select id from mm where k = 'g3'));
select story_review(pg_temp.token('g3'), '00000000-0000-4000-8000-000000014405', true, 'dev_g');
select pg_temp.post('g4', 'g', interval '4 minutes');
select story_bind((pg_temp.story('g4')).id, (select id from mm where k = 'g4'));
select story_review(pg_temp.token('g4'), '00000000-0000-4000-8000-000000014405', true, 'dev_g');
select story_settle((pg_temp.story('g4')).id, true);

select wallet_refund_purchase(id, 10000) from sp where k in ('g1', 'g2', 'g3', 'g4');

select is(
  (select array_agg(s.k || ':' || st.state || ':' || coalesce(st.void_reason, '-') || ':' || (st.mention_id is null)
                    order by s.k)
     from sp s join public.stories st on st.purchase_id = s.id where s.k like 'g%'),
  array['g1:void:refunded:true', 'g2:void:refunded:true', 'g3:void:refunded:true', 'g4:released:-:false'],
  'a refund voids a waiting, found or approved Story and frees its story; a released one stays released'
);

select is(
  (select -sum(amount_cents)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'g4') and kind = 'reversal'),
  15000,
  'a released bonus is clawed back with the principal'
);

select is(
  story_settle((pg_temp.story('g3')).id, true) ->> 'outcome',
  'already_decided',
  'the re-check never pays a refunded Story'
);

select is(
  story_review(pg_temp.token('g2'), '00000000-0000-4000-8000-000000014405', true, 'dev_g') ->> 'code',
  'gone',
  'a waiter cannot approve a story a refund freed'
);

-- ━━━ The operator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_override_story((select id from sp where k = 'f1'), 'release') ->> 'outcome',
  'released',
  'release lifts a void that never paid a bonus'
);

select ok(
  (select s.state = 'released' and s.void_reason is null
          and (select sum(amount_cents) from public.wallet_entries where purchase_id = s.purchase_id and kind = 'bonus') = 5000
     from pg_temp.story('f1') s),
  'and writes the bonus entry'
);

select is(
  wallet_override_story((select id from sp where k = 'a'), 'void') ->> 'reversed_cents',
  '5000',
  'void after release reverses the bonus the guest still holds'
);

select is(
  wallet_override_story((select id from sp where k = 'a'), 'release') ->> 'code',
  'already_decided',
  'a void that reversed a paid bonus cannot be released again'
);

select is(
  wallet_override_story((select id from sp where k = 'a'), 'unapprove') ->> 'code',
  'bad_request',
  'only release and void'
);

-- ━━━ The deploy window: the old names ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- An old buy reserved a story a waiter of the place already approved.
select pg_temp.post('h1', 'h', interval '5 minutes');
select pg_temp.post('h2', 'h', interval '4 minutes');
update public.story_mentions
   set review_place_id = '00000000-0000-4000-8000-000000014405', review = 'approved', reviewed_at = now() - interval '1 minute',
       review_device_hash = 'dev_old', review_token = replace(gen_random_uuid()::text, '-', '')
 where id = (select id from mm where k = 'h1');
update public.wallet_purchases set story_mention_id = (select id from mm where k = sp.k)
  from sp where sp.id = wallet_purchases.id and sp.k in ('h1', 'h2');

select is(
  wallet_credit_purchase((select id from sp where k = 'h1'), 'pi_test_4405h1', null) ->> 'story',
  'approved',
  'an old buy''s approved story credits as an approved Story'
);

select ok(
  (select s.mention_id = (select id from mm where k = 'h1') and s.approved_device_hash = 'dev_old'
          and s.recheck_at = now() + interval '3 hours'
     from pg_temp.story('h1') s),
  'with the waiter''s phone and the re-check from the payment'
);

select is(
  story_claim((select id from sp where k = 'h2')),
  'found',
  'the old claim name creates the Story; an unapproved reserved story is found'
);

select ok(
  (select review_token is not null from public.story_mentions where id = (select id from mm where k = 'h2')),
  'and has its QR'
);

select is(
  story_review_open((select id from mm where k = 'h2'), '00000000-0000-4000-8000-000000024405') ->> 'place_id',
  '00000000-0000-4000-8000-000000014405',
  'the old point-at-place never moves a story a Story holds'
);

-- ━━━ The 24-hour sweep ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.story_mentions set mentioned_at = now() - interval '30 hours'
 where id in (select id from mm where k in ('a_old', 'a2', 'g2', 'f3'));

select ok(
  wallet_purge_story_mentions(now() - interval '24 hours') >= 2,
  'the sweep deletes old stories'
);

select ok(
  not exists (select 1 from public.story_mentions where id in (select id from mm where k in ('a_old', 'g2'))),
  'an unbound one and one a refund freed are gone'
);

select ok(
  exists (select 1 from public.story_mentions where id = (select id from mm where k = 'f3')),
  'a story a non-void Story holds stays'
);

select ok(
  (pg_temp.story('a')).mention_id is null,
  'a void Story''s story may go; its link just clears'
);

-- ━━━ The data move ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, paid_at, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, livemode,
                                     story_activated_at, story_bonus, story_bonus_void_reason, story_bonus_decided_at)
values
  ('00000000-0000-4000-8000-000000440501', (select id from cs where k = 'o'), '00000000-0000-4000-8000-000000014405',
   10000, 'mxn', 'paid', now() - interval '2 days', 'acct_test_4405', 'voucher_story', 5000, 500, false,
   now() - interval '2 days', 'released', null, now() - interval '47 hours'),
  ('00000000-0000-4000-8000-000000440502', (select id from cs where k = 'o'), '00000000-0000-4000-8000-000000014405',
   10000, 'mxn', 'paid', now() - interval '2 days', 'acct_test_4405', 'voucher_story', 5000, 500, false,
   null, 'void', 'mention_lost', now() - interval '2 days');

select is(stories_move_legacy(), 2, 'the move writes one Story per legacy purchase');

select is(
  (select array_agg(state || ':' || coalesce(void_reason, '-') order by purchase_id) from public.stories
    where purchase_id in ('00000000-0000-4000-8000-000000440501', '00000000-0000-4000-8000-000000440502')),
  array['released:-', 'void:operator'],
  'released stays released; a legacy void reason reads operator'
);

select is(stories_move_legacy(), 0, 'the move is idempotent');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, paid_at, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, livemode)
values ('00000000-0000-4000-8000-000000440503', (select id from cs where k = 'o'), '00000000-0000-4000-8000-000000014405',
        10000, 'mxn', 'paid', now(), 'acct_test_4405', 'voucher_story', 5000, 500, false);

select throws_ok(
  'select stories_move_legacy()',
  'P0001', null,
  'an undecided purchase with no claimed story stops the move'
);

select * from finish();
rollback;
