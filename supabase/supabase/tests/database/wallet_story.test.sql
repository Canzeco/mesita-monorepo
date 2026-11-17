-- MESITA-3507, MESITA-4264, MESITA-4297 — the Story voucher: the waiter
-- verifies the story first (a story check), then the guest pays. What the
-- guest paid is Available at payment; the check is used once; every odd case
-- (no check, used, reopened, no story) still credits the money and voids only
-- the bonus (not_verified); the bonus re-check is paid_at + 3 hours; the
-- rules never raise; the cron expires checks and sweeps old stories; the
-- operator can expire a check, release its story, release or void a bonus;
-- the retired RPCs write nothing; nobody but the EFs calls any of it.

begin;

create extension if not exists pgtap with schema public;

select plan(54);

-- ━━━ Fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Guest A (story_probe_a), guest B (story_probe_b), two places.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4297'),
  ('00000000-0000-4000-8000-0000000b4297');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count) values
  ('00000000-0000-4000-8000-0000000a4297', 'story_probe_a', now(), 5000),
  ('00000000-0000-4000-8000-0000000b4297', 'story_probe_b', now(), 5000);
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014297', 'Story Probe One'),
  ('00000000-0000-4000-8000-000000024297', 'Story Probe Two');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014297', 'mesita-4297-probe-one', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024297', 'mesita-4297-probe-two', 'active', 'generating', 'MXN');

create temp table k (name text primary key, v uuid);
insert into k values
  ('A', '00000000-0000-4000-8000-0000000a4297'),
  ('B', '00000000-0000-4000-8000-0000000b4297'),
  ('P1', '00000000-0000-4000-8000-000000014297'),
  ('P2', '00000000-0000-4000-8000-000000024297');
create function pg_temp.k(n text) returns uuid language sql as $$ select v from k where name = n $$;

-- An open Story purchase of guest A at place 1, presenting p_check.
create function pg_temp.story_buy(p_check uuid, p_who text default 'A', p_place text default 'P1')
 returns uuid language sql as $$
  insert into public.wallet_purchases (consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                       voucher, bonus_cents, application_fee_cents, livemode, story_check_id)
  values (pg_temp.k(p_who), pg_temp.k(p_place), 10000, 'mxn', 'open', 'acct_test_4297', 'voucher_story', 3000, 500, false, p_check)
  returning id $$;

-- A fresh test-mode story of guest A, n minutes old.
create function pg_temp.story(p_id text, p_minutes int default 1, p_handle text default 'story_probe_a', p_live boolean default false)
 returns uuid language sql as $$
  select (wallet_record_story_mention(p_handle, case when p_live then 'meta' else 'emulator' end, p_id, null, 'image',
          now() - make_interval(mins => p_minutes), p_live) ->> 'id')::uuid $$;

-- Guest A's check at place 1, approved on a fresh story.
create function pg_temp.approved_check(p_story text) returns uuid language plpgsql as $$
declare c uuid; t text;
begin
  c := (wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P1'), false) -> 'check' ->> 'id')::uuid;
  select token into t from public.story_checks where id = c;
  perform wallet_review_story_check(t, pg_temp.story(p_story), true, 'dev_hash');
  return c;
end $$;

create function pg_temp.tok(p_check uuid) returns text language sql as $$ select token from public.story_checks where id = p_check $$;

-- ━━━ EF-only ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select ok(
  not exists (
    select 1 from unnest(array[
      'public.wallet_open_story_check(uuid, uuid, boolean)',
      'public.wallet_review_story_check(text, uuid, boolean, text)',
      'public.wallet_reopen_story_check(uuid)',
      'public.wallet_sweep_stories(integer)',
      'public.wallet_story_check_admin(uuid, text)',
      'public.story_rules()',
      'public.story_migration_guard()',
      'public.wallet_review_story(text, uuid, boolean, text)',
      'public.wallet_settle_story_recheck(uuid, boolean)',
      'public.wallet_override_story(uuid, text, uuid)'
    ]) f, unnest(array['anon', 'authenticated']) r
    where has_function_privilege(r, f, 'EXECUTE')),
  'every Story RPC is service-role only'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.story_checks'::regclass)
    and not has_table_privilege('anon', 'public.story_checks', 'SELECT')
    and not has_table_privilege('authenticated', 'public.story_checks', 'SELECT'),
  'story_checks is RLS-locked and EF-only'
);

-- ━━━ The rules: clamped, never raising ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  (select array[bonus_wait::text, approve_valid::text, max_story_age::text] from story_rules()),
  array['03:00:00', '02:00:00', '16:30:00'],
  'defaults: bonus 3 h after payment, 2 h to pay, stories up to 16 h 30 min old'
);

update public.app_config set money_config = money_config || '{"story_approve_valid_sec": 999999}'::jsonb where id = 1;
select is((select approve_valid::text from story_rules()), '04:00:00', 'a huge pay window clamps to 4 hours');

update public.app_config set money_config = money_config || '{"story_approve_valid_sec": "nonsense"}'::jsonb where id = 1;
select is((select approve_valid::text from story_rules()), '02:00:00', 'a non-number reads the default, never raises');
update public.app_config set money_config = money_config || '{"story_approve_valid_sec": 7200}'::jsonb where id = 1;

-- ━━━ Opening a check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table c (name text primary key, v uuid);
insert into c select 'c1', (wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P1'), false) -> 'check' ->> 'id')::uuid;

select is(
  (wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P1'), false) -> 'check' ->> 'id')::uuid,
  (select v from c where name = 'c1'),
  'opening again returns the same check'
);

select ok(
  (select state = 'open' and token ~ '^[0-9a-f]{32}$' and expires_at > now() + interval '23 hours'
     from public.story_checks where id = (select v from c where name = 'c1')),
  'a new check is open, 32-hex token, 24 hours'
);

select throws_ok(
  format($$insert into public.story_checks (consumer_id, place_id, livemode) values (%L, %L, false)$$, pg_temp.k('A'), pg_temp.k('P1')),
  '23505', null,
  'one open-or-approved check per guest, place and mode'
);

-- ━━━ The waiter's review ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_review_story_check('ffffffffffffffffffffffffffffffff', pg_temp.story('s-x'), true) ->> 'code',
  'gone', 'an unknown token is gone'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), null, false) ->> 'outcome',
  'rejected', 'the waiter rejects'
);

select ok(
  (select state = 'open' and last_rejected_at is not null from public.story_checks where id = (select v from c where name = 'c1')),
  'a reject keeps the check open, with last_rejected_at'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), pg_temp.story('s-b', 1, 'story_probe_b'), true) ->> 'code',
  'handle_mismatch', 'another account''s story cannot be approved'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), pg_temp.story('s-old', 17 * 60), true) -> 'age_sec' is not null
    and wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), pg_temp.story('s-old2', 17 * 60), true) ->> 'code' = 'story_too_old',
  true, 'a story older than 16 h 30 min is too old, with its age'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), pg_temp.story('s1'), true) ->> 'outcome',
  'approved', 'after a reject, a story can be approved'
);

select ok(
  (select state = 'approved' and expires_at = approved_at + interval '2 hours' and approved_by_device is null
     from public.story_checks where id = (select v from c where name = 'c1'))
    and (select check_id = (select v from c where name = 'c1') from public.story_mentions where ig_story_id = 's1'),
  'approval claims the story; the check is good 2 hours'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')),
    (select id from public.story_mentions where ig_story_id = 's1'), true) ->> 'outcome',
  'already_approved', 'a second approve of the same story answers the stored approval'
);

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c1')), null, false) ->> 'code',
  'already_decided', 'a reject after the approval is already_decided'
);

insert into c select 'cB', (wallet_open_story_check(pg_temp.k('B'), pg_temp.k('P1'), false) -> 'check' ->> 'id')::uuid;
select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'cB')),
    (select id from public.story_mentions where ig_story_id = 's1'), true) ->> 'code',
  'story_claimed', 'another guest''s check cannot take a claimed story'
);

insert into c select 'cLive', (wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P2'), true) -> 'check' ->> 'id')::uuid;
select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'cLive')), pg_temp.story('s-emu'), true) ->> 'code',
  'emulator_on_live', 'a test (emulator) story cannot approve a live check'
);

-- ━━━ Paying with the check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

create temp table p (name text primary key, v uuid);
insert into p select 'p1', pg_temp.story_buy((select v from c where name = 'c1'));

select is(
  wallet_credit_purchase((select v from p where name = 'p1'), 'pi_test_4297_1', null) ->> 'story',
  'waiting', 'a Story paid with an approved check is credited and waits for its bonus'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select v from p where name = 'p1') and available_at <= now()),
  array['voucher:10000'], 'what the guest paid is Available at once; no bonus yet'
);

select ok(
  (select story_review = 'approved' and story_recheck_at = paid_at + interval '3 hours' and story_token is null
     from public.wallet_purchases where id = (select v from p where name = 'p1')),
  'the bonus re-check is 3 hours after payment; no purchase-level token'
);

select ok(
  (select state = 'used' and used_by_purchase = (select v from p where name = 'p1')
     from public.story_checks where id = (select v from c where name = 'c1'))
    and (select purchase_id = (select v from p where name = 'p1') from public.story_mentions where ig_story_id = 's1'),
  'the check is used and its story belongs to the purchase'
);

insert into p select 'p2', pg_temp.story_buy((select v from c where name = 'c1'));
select is(
  wallet_credit_purchase((select v from p where name = 'p2'), 'pi_test_4297_2', null) ->> 'why',
  'used', 'a second purchase of the same check is credited …'
);

select ok(
  (select story_bonus = 'void' and story_bonus_void_reason = 'not_verified' from public.wallet_purchases where id = (select v from p where name = 'p2'))
    and (select array_agg(kind) from public.wallet_entries where purchase_id = (select v from p where name = 'p2')) = array['voucher']
    and (select used_by_purchase = (select v from p where name = 'p1') from public.story_checks where id = (select v from c where name = 'c1')),
  '… with its money and no bonus (not_verified); the check still names the first'
);

insert into p select 'pNull', pg_temp.story_buy(null);
select is(
  wallet_credit_purchase((select v from p where name = 'pNull'), 'pi_test_4297_n', null) ->> 'why',
  'no_check', 'a Story with no check (the deploy window) credits its money, bonus not_verified'
);

-- Approved, then its 2 hours passed while the bank check ran: still counts.
insert into c select 'c2', pg_temp.approved_check('s2');
insert into p select 'p3', pg_temp.story_buy((select v from c where name = 'c2'));
update public.story_checks set state = 'expired', expires_at = now() - interval '1 minute' where id = (select v from c where name = 'c2');
select is(
  wallet_credit_purchase((select v from p where name = 'p3'), 'pi_test_4297_3', null) ->> 'story',
  'waiting', 'a check that expired after the buy door still counts at credit'
);

-- Approved, then its story removed before payment: open again, no bonus.
insert into c select 'c3', pg_temp.approved_check('s3');
insert into p select 'p4', pg_temp.story_buy((select v from c where name = 'c3'));
select is(wallet_reopen_story_check((select v from c where name = 'c3')) ->> 'outcome', 'reopened', 'a removed story reopens the check');
select ok(
  (select state = 'open' and approved_at is null and expires_at = created_at + interval '24 hours'
     from public.story_checks where id = (select v from c where name = 'c3'))
    and (select check_id is null from public.story_mentions where ig_story_id = 's3'),
  'reopened: open, no approval, its first 24 hours, the story let go'
);
select is(
  wallet_credit_purchase((select v from p where name = 'p4'), 'pi_test_4297_4', null) ->> 'why',
  'not_approved', 'paying on a reopened check credits the money, bonus not_verified'
);

-- Approved, then its story moved away (no story left): no bonus.
select wallet_story_check_admin((select v from c where name = 'c3'), 'expire_check');
insert into c select 'c4', pg_temp.approved_check('s4');
insert into p select 'p5', pg_temp.story_buy((select v from c where name = 'c4'));
update public.story_mentions set check_id = null where ig_story_id = 's4';
select is(
  wallet_credit_purchase((select v from p where name = 'p5'), 'pi_test_4297_5', null) ->> 'why',
  'no_story', 'an approved check with no story left credits the money, bonus not_verified'
);

-- ━━━ The link moves from an expired, unused check ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.story_checks set state = 'expired' where id = (select v from c where name = 'c4');
update public.story_mentions set check_id = (select v from c where name = 'c4') where ig_story_id = 's4';
insert into c select 'c5', (wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P1'), false) -> 'check' ->> 'id')::uuid;

select is(
  wallet_review_story_check(pg_temp.tok((select v from c where name = 'c5')),
    (select id from public.story_mentions where ig_story_id = 's4'), true) ->> 'outcome',
  'approved', 'one waiter scan re-approves the same story on the guest''s next check'
);

select is(
  (select check_id from public.story_mentions where ig_story_id = 's4'),
  (select v from c where name = 'c5'), 'and the story''s link moves to it'
);

-- ━━━ A mode flip ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_open_story_check(pg_temp.k('A'), pg_temp.k('P1'), true);
select is(
  (select state from public.story_checks where id = (select v from c where name = 'c5')),
  'expired', 'opening in the other payments mode expires this mode''s check'
);

-- ━━━ The cron ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into c select 'cOld', (wallet_open_story_check(pg_temp.k('B'), pg_temp.k('P2'), false) -> 'check' ->> 'id')::uuid;
update public.story_checks set expires_at = now() - interval '1 minute' where id = (select v from c where name = 'cOld');
select pg_temp.story('s-gone', 25 * 60);
update public.story_mentions set mentioned_at = now() - interval '25 hours' where ig_story_id = 's-held';
insert into c select 'cHeld', pg_temp.approved_check('s-held');
update public.story_mentions set mentioned_at = now() - interval '25 hours' where ig_story_id = 's-held';

select ok(
  (wallet_sweep_stories(200) ->> 'expired')::int >= 1,
  'the sweep expires checks past their time'
);

select ok(
  (select state = 'expired' from public.story_checks where id = (select v from c where name = 'cOld'))
    and not exists (select 1 from public.story_mentions where ig_story_id = 's-gone')
    and exists (select 1 from public.story_mentions where ig_story_id = 's-held'),
  'an old free story is deleted; one an approved check holds is kept'
);

-- ━━━ The bonus 3 hours after payment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(
  wallet_settle_story_recheck((select v from p where name = 'p1'), true) ->> 'outcome',
  'released', 'a story still up releases the bonus'
);

select is(
  (select array_agg(kind || ':' || amount_cents order by kind) from public.wallet_entries
    where purchase_id = (select v from p where name = 'p1') and available_at <= now()),
  array['bonus:3000', 'voucher:10000'], 'the bonus is Available now'
);

select is(
  wallet_settle_story_recheck((select v from p where name = 'p1'), true) ->> 'outcome',
  'already_decided', 'a second settle writes nothing'
);

select wallet_settle_story_recheck((select v from p where name = 'p3'), false);
select wallet_settle_story_recheck((select v from p where name = 'p3'), false);
select is(
  wallet_settle_story_recheck((select v from p where name = 'p3'), false) ->> 'outcome',
  'voided', 'three failed re-checks void the bonus; the money stays'
);

select is(
  wallet_settle_story_recheck((select v from p where name = 'p2'), true) ->> 'outcome',
  'already_decided', 'a not_verified Story is never released by the re-check'
);

-- ━━━ Refunds and the operator ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select wallet_refund_purchase((select v from p where name = 'p1'), 10000);
select is(
  (select -sum(amount_cents)::int from public.wallet_entries where purchase_id = (select v from p where name = 'p1') and kind = 'reversal'),
  13000, 'after release a full refund reverses principal and bonus'
);

select is(
  wallet_refund_purchase((select v from p where name = 'p2'), 10000) ->> 'status',
  'refunded', 'a not_verified Story refunds its principal only'
);

select is(wallet_override_story((select v from p where name = 'p2'), 'unapprove') ->> 'code', 'unknown_action', 'unapprove is gone');
select is(wallet_story_check_admin((select v from c where name = 'cHeld'), 'nope') ->> 'code', 'unknown_action', 'an unknown check action is refused');

select is(
  wallet_story_check_admin((select v from c where name = 'cHeld'), 'release_story') ->> 'outcome',
  'reopened', 'the operator lets go of a check''s story'
);
select is(
  wallet_story_check_admin((select v from c where name = 'cHeld'), 'expire_check') ->> 'outcome',
  'expired', 'and can expire a check'
);
select is(
  wallet_story_check_admin((select v from c where name = 'c1'), 'expire_check') ->> 'code',
  'used', 'a used check cannot be touched'
);

-- ━━━ Retired ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(wallet_review_story('ffffffffffffffffffffffffffffffff', null, true) ->> 'code', 'reload', 'the purchase-level review answers reload');
select is(wallet_expire_stories(50), 0, 'the 7-day expiry does nothing');
select is(wallet_activate_story('ffffffffffffffffffffffffffffffff') ->> 'code', 'reload', 'the old activate answers reload');

-- ━━━ The migration guard ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

update public.wallet_purchases set status = 'paid', story_bonus = null, story_bonus_void_reason = null, story_review = null
 where id = (select v from p where name = 'pNull');
select ok(
  story_migration_guard() -> 'paid_unapproved' @> to_jsonb(array[(select v from p where name = 'pNull')]),
  'the guard names a paid Story waiting on the old review'
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
  'every paid Story holds its voucher entry'
);

select * from finish();
rollback;
