-- MESITA-3507, MESITA-4264, MESITA-4296 — the Story voucher, verified BEFORE
-- it is paid: the guest shows a story (an @mesita mention under their
-- verified handle), the buy reserves it (one live purchase per story), the
-- credit lands the voucher at once and claims the story (unclaimed, the
-- guest's current handle, the same mode, young enough to outlive the
-- re-check; otherwise the bonus is void, never the money), the re-check 3
-- hours after payment releases the bonus or voids it after three failures
-- (a story past its own 24 hours counts as kept), a full refund frees the
-- story, the 24-hour sweep keeps live reservations, the operator can release
-- (lifting a void that paid nothing) or void; staff's functions are gone;
-- nobody but the EFs calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(39);

-- ━━━ Fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4296'),
  ('00000000-0000-4000-8000-0000000b4296');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_is_private) values
  ('00000000-0000-4000-8000-0000000a4296', 'story_probe_a', now(), 5000, false),
  ('00000000-0000-4000-8000-0000000b4296', 'story_probe_b', now(), 5000, false);
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014296', 'Story Probe One');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014296', 'mesita-4296-probe-one', 'active', 'generating', 'MXN');

-- The stories, by key. Ages are against now(): the credit needs
-- mentioned_at + 24 h >= now + 3 h + 60 min, i.e. at most 20 hours old.
create temp table mm (k text primary key, id uuid);
insert into mm
select k, (wallet_record_story_mention(h, 'emulator', 'emu-4296-' || k, null, 'image', now() - age, live) ->> 'id')::uuid
  from (values
    ('d',    'story_probe_a', interval '5 minutes',           false),
    ('e',    'story_probe_a', interval '19 hours 59 minutes', false),
    ('f',    'story_probe_a', interval '20 hours 1 minute',   false),
    ('g',    'story_probe_b', interval '5 minutes',           false),
    ('i',    'story_probe_a', interval '5 minutes',           true),
    ('r',    'story_probe_a', interval '5 minutes',           false),
    ('p',    'story_probe_a', interval '5 minutes',           false),
    ('x',    'story_probe_a', interval '5 minutes',           false),
    ('n',    'story_probe_a', interval '5 minutes',           false),
    ('old',  'story_probe_a', interval '25 hours',            false),
    ('keep', 'story_probe_a', interval '25 hours',            false),
    ('gone', 'story_probe_a', interval '25 hours',            false)
  ) as t(k, h, age, live);

-- One Story purchase per case, reserving the story of the same key (h none,
-- y the same story as x).
create temp table sp (k text primary key, id uuid, mention text, status text);
insert into sp values
  ('d', '00000000-0000-4000-8000-0000004296d0', 'd', 'open'),
  ('e', '00000000-0000-4000-8000-0000004296e0', 'e', 'open'),
  ('f', '00000000-0000-4000-8000-0000004296f0', 'f', 'open'),
  ('g', '00000000-0000-4000-8000-0000004296a1', 'g', 'open'),
  ('h', '00000000-0000-4000-8000-0000004296a2', null, 'open'),
  ('i', '00000000-0000-4000-8000-0000004296a3', 'i', 'open'),
  ('r', '00000000-0000-4000-8000-0000004296a4', 'r', 'open'),
  ('p', '00000000-0000-4000-8000-0000004296a5', 'p', 'open'),
  ('x', '00000000-0000-4000-8000-0000004296a6', 'x', 'expired'),
  ('y', '00000000-0000-4000-8000-0000004296a7', 'x', 'open'),
  ('n', '00000000-0000-4000-8000-0000004296a8', 'n', 'open'),
  ('keep', '00000000-0000-4000-8000-0000004296a9', 'keep', 'open'),
  ('gone', '00000000-0000-4000-8000-0000004296aa', 'gone', 'expired');

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode,
                                     story_mention_id)
select sp.id, '00000000-0000-4000-8000-0000000a4296', '00000000-0000-4000-8000-000000014296', 10000, 'mxn', sp.status,
       'acct_test_4296', 'voucher_story', 5000, 500, 'cs_test_4296' || sp.k, false, mm.id
  from sp left join mm on mm.k = sp.mention;

-- ━━━ EF-only; staff's functions are gone ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (
    select 1 from unnest(array[
      'public.wallet_record_story_mention(text, text, text, text, text, timestamptz, boolean, text)',
      'public.wallet_settle_story_recheck(uuid, boolean)',
      'public.wallet_override_story(uuid, text, uuid)',
      'public.story_claim(uuid)',
      'public.wallet_purge_story_mentions(timestamptz)',
      'public.wallet_credit_purchase(uuid, text, timestamptz)',
      'public.wallet_refund_purchase(uuid, integer, text)',
      'public.story_rules()'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'every Story RPC is service-role only'
);

select ok(
  not exists (select 1 from pg_proc
               where pronamespace = 'public'::regnamespace
                 and proname in ('wallet_review_story', 'wallet_activate_story', 'wallet_expire_stories')),
  'staff review, activate and the 7-day expiry are gone'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.story_mentions'::regclass)
    and not has_table_privilege('anon', 'public.story_mentions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.story_mentions', 'SELECT'),
  'story_mentions is RLS-locked and EF-only'
);

-- ━━━ One live reservation per story ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
      voucher, bonus_cents, application_fee_cents, livemode, story_mention_id)
    values ('00000000-0000-4000-8000-0000000b4296', '00000000-0000-4000-8000-000000014296', 10000, 'mxn', 'open',
      'acct_test_4296', 'voucher_story', 5000, 500, false, (select id from mm where k = 'd'))$$,
  '23505',
  null,
  'a second live purchase cannot reserve a story already reserved'
);

select is(
  (select count(*)::int from public.wallet_purchases where story_mention_id = (select id from mm where k = 'x')),
  2,
  'an expired purchase frees its story for another try'
);

-- ━━━ The credit: the voucher now, then the claim ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase((select id from sp where k = 'd'), 'pi_test_4296d', null) ->> 'story',
  'claimed',
  'a fresh story of the guest is claimed at the credit'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select id from sp where k = 'd') and available_at <= now()),
  array['voucher:10000'],
  'what the guest paid is Available at once; no bonus entry yet'
);

select ok(
  (select p.story_activated_at is not null
          and p.story_recheck_at = p.story_activated_at + interval '3 hours'
          and p.story_bonus is null
          and m.purchase_id = p.id
     from public.wallet_purchases p join public.story_mentions m on m.id = p.story_mention_id
    where p.id = (select id from sp where k = 'd')),
  'the claim sets the re-check to payment + 3 hours and the story names the purchase'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'e'), 'pi_test_4296e', null) ->> 'story',
  'claimed',
  'a story just under 20 hours old still outlives the re-check by the margin'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'f'), 'pi_test_4296f', null) ->> 'story',
  'mention_lost',
  'a story just over 20 hours old does not'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'g'), 'pi_test_4296g', null) ->> 'story',
  'mention_lost',
  'another guest''s story never pays this guest''s bonus'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'h'), 'pi_test_4296h', null) ->> 'story',
  'no_mention',
  'a Story credited without a reservation voids its bonus (no_mention)'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'i'), 'pi_test_4296i', null) ->> 'story',
  'mention_lost',
  'a live story never pays a test purchase'
);

select ok(
  (select bool_and(story_bonus = 'void' and story_activated_at is null)
     from public.wallet_purchases where id in (select id from sp where k in ('f', 'g', 'h', 'i'))),
  'a lost story voids only the bonus'
);

select is(
  (select count(*)::int from public.wallet_entries
    where kind = 'voucher' and purchase_id in (select id from sp where k in ('f', 'g', 'h', 'i'))),
  4,
  'the money still lands on every one of them'
);

-- y claims x's story first; then Stripe pays the expired x anyway.
select is(
  wallet_credit_purchase((select id from sp where k = 'y'), 'pi_test_4296y', null) ->> 'story',
  'claimed',
  'the retry claims the story its expired try left'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'x'), 'pi_test_4296x', null) ->> 'story',
  'mention_lost',
  'a Stripe success on the expired try is credited, its bonus void'
);

select ok(
  (select status = 'paid' and story_bonus_void_reason = 'mention_lost'
     from public.wallet_purchases where id = (select id from sp where k = 'x')),
  'the expired try reads paid, mention_lost'
);

select is(
  wallet_credit_purchase((select id from sp where k = 'd'), 'pi_test_4296d', null) ->> 'outcome',
  'already_paid',
  'a second webhook credits nothing'
);

-- ━━━ The re-check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_settle_story_recheck((select id from sp where k = 'd'), true) ->> 'outcome',
  'released',
  'a story still up releases the bonus, no approval needed'
);

select is(
  (select sum(amount_cents)::int from public.wallet_entries
    where purchase_id = (select id from sp where k = 'd') and kind = 'bonus'),
  5000,
  'the bonus entry is written once'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'd'), true) ->> 'outcome',
  'already_decided',
  'a decided bonus is not touched again'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'e'), false) ->> 'outcome',
  'retry',
  'a first failure retries'
);
select wallet_settle_story_recheck((select id from sp where k = 'e'), false);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'e'), false) ->> 'reason',
  'unreachable',
  'the third failure voids the bonus (unreachable)'
);

-- n: claimed now, then its story ages past 24 hours before the re-check.
select wallet_credit_purchase((select id from sp where k = 'n'), 'pi_test_4296n', null);
update public.story_mentions set mentioned_at = now() - interval '25 hours' where id = (select id from mm where k = 'n');

select is(
  wallet_settle_story_recheck((select id from sp where k = 'n'), false) ->> 'natural_end',
  'true',
  'a story past its own 24 hours ended on its own: the bonus is released'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'h'), true) ->> 'outcome',
  'already_decided',
  'a no_mention bonus is decided; the re-check leaves it'
);

-- ━━━ Refunds ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_credit_purchase(id, 'pi_test_4296' || k, null) from sp where k in ('r', 'p');

select is(
  wallet_refund_purchase((select id from sp where k = 'r'), 10000) ->> 'status',
  'refunded',
  'a full refund applies'
);

select ok(
  (select story_mention_id is null and story_recheck_at is null
          and story_bonus = 'void' and story_bonus_void_reason = 'refunded'
     from public.wallet_purchases where id = (select id from sp where k = 'r'))
  and (select purchase_id is null from public.story_mentions where id = (select id from mm where k = 'r')),
  'a full refund frees the story and voids the bonus'
);

select ok(
  (select story_recheck_at is null from public.wallet_purchases where id = (select id from sp where k = 'r')),
  'the cron never picks a fully refunded Story'
);

select wallet_refund_purchase((select id from sp where k = 'p'), 4000);

select ok(
  (select p.story_mention_id = m.id and m.purchase_id = p.id and p.story_bonus_void_reason = 'refunded'
     from public.wallet_purchases p join public.story_mentions m on m.id = (select id from mm where k = 'p')
    where p.id = (select id from sp where k = 'p')),
  'a partial refund keeps the claim and voids the bonus'
);

-- ━━━ The 24-hour sweep keeps live reservations ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  wallet_purge_story_mentions(now() - interval '24 hours') >= 2,
  'the sweep deletes old unclaimed stories'
);

select ok(
  not exists (select 1 from public.story_mentions where id = (select id from mm where k = 'old')),
  'an old story nobody reserved is gone'
);

select ok(
  exists (select 1 from public.story_mentions where id = (select id from mm where k = 'keep')),
  'an old story a live purchase still reserves stays'
);

select ok(
  not exists (select 1 from public.story_mentions where id = (select id from mm where k = 'gone'))
    and (select story_mention_id is null from public.wallet_purchases where id = (select id from sp where k = 'gone')),
  'an old story reserved only by an expired purchase is gone, the reservation cleared'
);

-- ━━━ The operator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_override_story((select id from sp where k = 'f'), 'release') ->> 'outcome',
  'released',
  'release lifts a void that never paid a bonus (mention_lost)'
);

select ok(
  (select story_bonus = 'released' and story_bonus_void_reason is null
          and (select sum(amount_cents) from public.wallet_entries where purchase_id = p.id and kind = 'bonus') = 5000
     from public.wallet_purchases p where p.id = (select id from sp where k = 'f')),
  'and writes the bonus entry'
);

select is(
  wallet_override_story((select id from sp where k = 'd'), 'void') ->> 'reversed_cents',
  '5000',
  'void after release reverses the bonus the guest still holds'
);

select is(
  wallet_override_story((select id from sp where k = 'd'), 'release') ->> 'code',
  'already_decided',
  'a void that reversed a paid bonus cannot be released again'
);

select is(
  wallet_override_story((select id from sp where k = 'd'), 'unapprove') ->> 'code',
  'bad_request',
  'unapprove is gone with staff review'
);

select * from finish();
rollback;
