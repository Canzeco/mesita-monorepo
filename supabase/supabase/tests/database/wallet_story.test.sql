-- MESITA-3507, MESITA-4264 — the Story voucher, verified from the @mesita
-- mention: what the guest paid is Available at payment; staff approve one
-- story (unclaimed, under 24 hours, the guest's verified handle; a test story
-- only on a test purchase); the bonus waits for the re-check, which releases
-- it once or voids it after three failures; refunds reverse only what the
-- ledger holds and void an undecided bonus; nobody approved in 7 days (from
-- max(paid_at, the anchor)) voids it; the operator can release, void
-- (reversing a released bonus) or unapprove; the old activate writes
-- nothing; nobody but the EFs calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(48);

-- ━━━ Fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Guest A (story_probe_a) and guest B (story_probe_b), two places.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4264'),
  ('00000000-0000-4000-8000-0000000b4264');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000a4264', 'story_probe_a', now(), 5000),
  ('00000000-0000-4000-8000-0000000b4264', 'story_probe_b', now(), 5000);
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014264', 'Story Probe One'),
  ('00000000-0000-4000-8000-000000024264', 'Story Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014264', 'mesita-4264-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024264', 'mesita-4264-probe-two', 'active', 'generating', 'MXN');

-- One Story purchase per case; the last hex pair names it.
create temp table sp (k text primary key, id uuid, consumer uuid, place uuid, live boolean);
insert into sp values
  ('d', '00000000-0000-4000-8000-0000004264d0', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('e', '00000000-0000-4000-8000-0000004264e0', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('f', '00000000-0000-4000-8000-0000004264f0', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('g', '00000000-0000-4000-8000-0000004264a1', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('h', '00000000-0000-4000-8000-0000004264a2', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('i', '00000000-0000-4000-8000-0000004264a3', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('j', '00000000-0000-4000-8000-0000004264a4', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', true),
  ('k', '00000000-0000-4000-8000-0000004264a5', '00000000-0000-4000-8000-0000000b4264', '00000000-0000-4000-8000-000000024264', false),
  ('l', '00000000-0000-4000-8000-0000004264a6', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false),
  ('q', '00000000-0000-4000-8000-0000004264a7', '00000000-0000-4000-8000-0000000a4264', '00000000-0000-4000-8000-000000014264', false);

insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                     voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id, livemode)
select id, consumer, place, 10000, 'mxn', 'open', 'acct_test_4264', 'voucher_story', 3000, 500, 'cs_test_4264' || k, live
  from sp;

-- The approve window starts at the anchor; tests move it.
update public.app_config set money_config = money_config || jsonb_build_object('story_expiry_anchor', now()) where id = 1;

create temp table mm (k text primary key, id uuid);

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (
    select 1 from unnest(array[
      'public.wallet_activate_story(text)',
      'public.wallet_review_story(text, uuid, boolean, text)',
      'public.wallet_record_story_mention(text, text, text, text, text, timestamptz, boolean, text)',
      'public.wallet_settle_story_recheck(uuid, boolean)',
      'public.wallet_expire_stories(integer)',
      'public.wallet_override_story(uuid, text, uuid)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'every Story RPC is service-role only'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.story_mentions'::regclass)
    and not has_table_privilege('anon', 'public.story_mentions', 'SELECT')
    and not has_table_privilege('authenticated', 'public.story_mentions', 'SELECT'),
  'story_mentions is RLS-locked and EF-only'
);

-- ━━━ Paid: the voucher Available now, no bonus ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_credit_purchase((select id from sp where k = 'd'), 'pi_test_4264d', null) ->> 'outcome',
  'credited',
  'a paid Story is credited'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select id from sp where k = 'd') and available_at <= now()),
  array['voucher:10000'],
  'what the guest paid is Available at once; no bonus entry yet'
);

select is(
  (select spendable_cents from public.wallet_balance('00000000-0000-4000-8000-0000000a4264',
     '00000000-0000-4000-8000-000000014264', 'mxn', false, now())),
  10000,
  'the guest can spend it that night'
);

select ok(
  (select story_token ~ '^[0-9a-f]{32}$' and story_review is null and story_bonus is null
     from public.wallet_purchases where id = (select id from sp where k = 'd')),
  'it carries a 32-hex Story token, unreviewed, bonus undecided'
);

-- Everyone else paid too.
select wallet_credit_purchase(id, 'pi_test_4264' || k, null) from sp where k <> 'd';

-- ━━━ Recording a mention ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into mm select 'm1', (wallet_record_story_mention('Story_Probe_A', 'emulator', 'emu-4264-1',
  'https://example.supabase.co/storage/v1/object/public/story-emulator/d/1.jpg?v=1', 'image', now(), false) ->> 'id')::uuid;

select is(
  wallet_record_story_mention('Story_Probe_A', 'emulator', 'emu-4264-1', null, 'image', now(), false) ->> 'outcome',
  'duplicate',
  'the same (source, story id) is recorded once'
);

select is(
  (select ig_handle from public.story_mentions where id = (select id from mm where k = 'm1')),
  'story_probe_a',
  'the handle is stored lowercased'
);

insert into mm
select 'mB', (wallet_record_story_mention('story_probe_b', 'emulator', 'emu-4264-b', null, 'image', now(), false) ->> 'id')::uuid
union all
select 'm2', (wallet_record_story_mention('story_probe_a', 'meta', 'mid.4264.2', null, 'image', now(), true) ->> 'id')::uuid
union all
select 'mOld', (wallet_record_story_mention('story_probe_a', 'meta', 'mid.4264.old', null, 'image', now() - interval '25 hours', true) ->> 'id')::uuid
union all
select 'm3', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-3', null, 'image', now(), false) ->> 'id')::uuid;

-- ━━━ The old activate writes nothing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_activate_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'd'))) ->> 'code',
  'reload',
  'wallet_activate_story answers reload'
);

select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'd')),
  1,
  'and writes no second voucher entry'
);

-- ━━━ Review ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_review_story('ffffffffffffffffffffffffffffffff', (select id from mm where k = 'm1'), true) ->> 'code',
  'gone',
  'an unknown token is gone'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'd')),
    (select id from mm where k = 'mB'), true) ->> 'code',
  'handle_mismatch',
  'a story from another handle cannot be approved'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'd')),
    null, false) ->> 'outcome',
  'rejected',
  'staff reject: nothing is claimed'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'd')),
    (select id from mm where k = 'm1'), true) ->> 'outcome',
  'approved',
  'after a reject, a story can still be approved'
);

select ok(
  (select story_review = 'approved' and story_recheck_at = story_activated_at + interval '3 hours'
     from public.wallet_purchases where id = (select id from sp where k = 'd'))
    and (select purchase_id = (select id from sp where k = 'd') from public.story_mentions where id = (select id from mm where k = 'm1')),
  'approval claims the story and sets the re-check 3 hours later'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'd')),
    (select id from mm where k = 'm1'), true) ->> 'outcome',
  'already_approved',
  'a second approve of the same story answers the stored time'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'h')),
    (select id from mm where k = 'm1'), true) ->> 'code',
  'mention_claimed',
  'one story pays one bonus: another purchase cannot claim it'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'k')),
    (select id from mm where k = 'm2'), true) ->> 'code',
  'handle_mismatch',
  'a Story at another place, of another guest, cannot take this guest''s story'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'h')),
    (select id from mm where k = 'mOld'), true) ->> 'code',
  'mention_expired',
  'a story older than 24 hours cannot be approved'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'j')),
    (select id from mm where k = 'm3'), true) ->> 'code',
  'livemode_mismatch',
  'a test (emulator) story cannot complete a live purchase'
);

-- ━━━ The re-check: released once ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_settle_story_recheck((select id from sp where k = 'd'), true) ->> 'outcome',
  'released',
  'a story still up releases the bonus'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select id from sp where k = 'd') and available_at <= now()),
  array['bonus:3000', 'voucher:10000'],
  'the bonus is Available now, the voucher entry untouched'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'd'), true) ->> 'outcome',
  'already_decided',
  'a second settle changes nothing'
);

select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'd')),
  2,
  'and writes no second bonus'
);

-- ━━━ The re-check: three failures void it ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into mm select 'm4', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-4', null, 'image', now(), false) ->> 'id')::uuid;
select wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'h')),
  (select id from mm where k = 'm4'), true);
select wallet_settle_story_recheck((select id from sp where k = 'h'), false);
select wallet_settle_story_recheck((select id from sp where k = 'h'), false);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'h'), false) ->> 'outcome',
  'voided',
  'the third failed re-check voids the bonus'
);

select ok(
  (select story_bonus = 'void' and story_bonus_void_reason = 'unreachable' and story_recheck_tries = 3
     from public.wallet_purchases where id = (select id from sp where k = 'h'))
    and (select array_agg(kind) from public.wallet_entries where purchase_id = (select id from sp where k = 'h')) = array['voucher'],
  'reason unreachable; the paid credit stays and no bonus is written'
);

-- ━━━ Refund before the bonus is released ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into mm select 'm5', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-5', null, 'image', now(), false) ->> 'id')::uuid;
select wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'f')),
  (select id from mm where k = 'm5'), true);

select is(
  wallet_refund_purchase((select id from sp where k = 'f'), 10000) ->> 'status',
  'refunded',
  'a full refund of an approved Story reads refunded'
);

select ok(
  (select -sum(amount_cents) from public.wallet_entries where purchase_id = (select id from sp where k = 'f') and kind = 'reversal') = 10000
    and (select story_bonus = 'void' and story_bonus_void_reason = 'refunded' from public.wallet_purchases where id = (select id from sp where k = 'f')),
  'it reverses only the principal and voids the bonus (reason refunded)'
);

select is(
  wallet_settle_story_recheck((select id from sp where k = 'f'), true) ->> 'outcome',
  'already_decided',
  'a re-check after the refund writes nothing'
);

select is(
  (select count(*)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'f') and kind = 'bonus'),
  0,
  'no bonus entry after a refund'
);

-- ━━━ Partial refund before approval ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_refund_purchase((select id from sp where k = 'e'), 4000) ->> 'status',
  'partly_refunded',
  'a partial refund of an unapproved Story reads partly_refunded'
);

select ok(
  (select -sum(amount_cents) from public.wallet_entries where purchase_id = (select id from sp where k = 'e') and kind = 'reversal') = 4000
    and (select story_bonus = 'void' and story_bonus_void_reason = 'refunded' from public.wallet_purchases where id = (select id from sp where k = 'e')),
  'it reverses the refunded principal (the voucher entry exists) and voids the bonus'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'e')),
    (select id from mm where k = 'm3'), true) ->> 'code',
  'refunded',
  'a partly refunded Story cannot be approved'
);

-- ━━━ Refund after release ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into mm select 'm6', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-6', null, 'image', now(), false) ->> 'id')::uuid;
select wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'g')),
  (select id from mm where k = 'm6'), true);
select wallet_settle_story_recheck((select id from sp where k = 'g'), true);
select wallet_refund_purchase((select id from sp where k = 'g'), 10000);

select is(
  (select -sum(amount_cents)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'g') and kind = 'reversal'),
  13000,
  'after release a full refund reverses principal and bonus, as for any voucher'
);

-- ━━━ Nobody approved it in 7 days ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.wallet_purchases set paid_at = now() - interval '8 days' where id = (select id from sp where k = 'i');
select wallet_expire_stories(50);

select ok(
  (select story_bonus is null from public.wallet_purchases where id = (select id from sp where k = 'i')),
  'the 7 days start no earlier than the anchor (the MESITA-4264 deploy)'
);

update public.app_config set money_config = money_config || jsonb_build_object('story_expiry_anchor', '2000-01-01T00:00:00Z') where id = 1;

select ok(
  wallet_expire_stories(50) >= 1,
  'past the window, the expiry voids it'
);

select ok(
  (select story_bonus = 'void' and story_bonus_void_reason = 'expired' from public.wallet_purchases where id = (select id from sp where k = 'i'))
    and (select array_agg(kind) from public.wallet_entries where purchase_id = (select id from sp where k = 'i')) = array['voucher'],
  'reason expired; the paid credit stays'
);

select is(
  wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'i')),
    (select id from mm where k = 'm3'), true) ->> 'code',
  'already_decided',
  'a review after the expiry answers already_decided'
);

-- ━━━ The operator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into mm select 'm7', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-7', null, 'image', now(), false) ->> 'id')::uuid;
select wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'l')),
  (select id from mm where k = 'm7'), true);

select is(
  wallet_override_story((select id from sp where k = 'l'), 'release') ->> 'outcome',
  'released',
  'the operator releases a bonus'
);

select is(
  wallet_override_story((select id from sp where k = 'l'), 'unapprove') ->> 'code',
  'already_decided',
  'unapprove is refused once the bonus is decided'
);

select is(
  (wallet_override_story((select id from sp where k = 'l'), 'void') ->> 'reversed_cents')::int,
  3000,
  'void after a release reverses the bonus'
);

select ok(
  (select story_bonus = 'void' and story_bonus_void_reason = 'operator' from public.wallet_purchases where id = (select id from sp where k = 'l'))
    and (select count(*) = 1 from public.wallet_entries
          where purchase_id = (select id from sp where k = 'l') and kind = 'reversal' and reason = 'story_void' and amount_cents = -3000),
  'reason operator, one story_void reversal'
);

select wallet_refund_purchase((select id from sp where k = 'l'), 10000);

select is(
  (select -sum(amount_cents)::int from public.wallet_entries where purchase_id = (select id from sp where k = 'l') and kind = 'reversal'),
  13000,
  'a refund after the void reverses the principal once, never the bonus twice'
);

insert into mm select 'm8', (wallet_record_story_mention('story_probe_a', 'emulator', 'emu-4264-8', null, 'image', now(), false) ->> 'id')::uuid;
select wallet_review_story((select story_token from public.wallet_purchases where id = (select id from sp where k = 'q')),
  (select id from mm where k = 'm8'), true);

select is(
  wallet_override_story((select id from sp where k = 'q'), 'unapprove') ->> 'outcome',
  'unapproved',
  'unapprove before the decision undoes the approval'
);

select ok(
  (select story_review is null and story_activated_at is null and story_recheck_at is null
     from public.wallet_purchases where id = (select id from sp where k = 'q'))
    and (select purchase_id is null from public.story_mentions where id = (select id from mm where k = 'm8')),
  'and frees the story'
);

-- ━━━ Invariants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (
    select 1 from public.wallet_entries e join public.wallet_purchases p on p.id = e.purchase_id
     where p.voucher = 'voucher_story' and e.kind = 'voucher'
     group by e.purchase_id having count(*) > 1),
  'one voucher entry per Story purchase'
);

select ok(
  not exists (
    select 1 from public.wallet_purchases p
     where p.voucher = 'voucher_story' and p.status = 'paid'
       and not exists (select 1 from public.wallet_entries e where e.purchase_id = p.id and e.kind = 'voucher')),
  'every paid Story holds its voucher entry (the backfill and wallet_credit_purchase)'
);

select ok(
  not exists (
    select 1 from public.wallet_purchases p
     where p.voucher = 'voucher_story' and p.status = 'paid'
       and p.story_activated_at is not null and p.story_review is distinct from 'approved'),
  'every paid Story with an approval time reads approved (the backfill)'
);

select * from finish();
rollback;
