-- MESITA-4766 — VIP is back (an invitation code only since MESITA-4849), Back has three lines (Welcome Everyone, Returning Regular,
-- Returning VIP), and Instagram Stories are gone.

begin;

create extension if not exists pgtap with schema public;

select plan(32);

-- Guests: i invited later, r regular, e emulated-only (300 real, 6,000
-- emulated), f real 6,000 followers, x exactly 5,000, t and u for codes.
insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4766'), ('00000000-0000-4000-8000-0000000b4766'),
  ('00000000-0000-4000-8000-0000000c4766'), ('00000000-0000-4000-8000-0000000d4766'),
  ('00000000-0000-4000-8000-0000000e4766'), ('00000000-0000-4000-8000-0000000f4766'),
  ('00000000-0000-4000-8000-000000104766'), ('00000000-0000-4000-8000-000000114766');
insert into public.consumers (id) values
  ('00000000-0000-4000-8000-0000000a4766'), ('00000000-0000-4000-8000-0000000b4766'),
  ('00000000-0000-4000-8000-0000000f4766'), ('00000000-0000-4000-8000-000000104766');
insert into public.consumers (id, instagram_handle, instagram_verified_at, instagram_followers_count, instagram_followers_emulated) values
  ('00000000-0000-4000-8000-0000000c4766', 'probe_4766_e', now(), 300, 6000),
  ('00000000-0000-4000-8000-0000000d4766', 'probe_4766_f', now(), 6000, null),
  ('00000000-0000-4000-8000-0000000e4766', 'probe_4766_x', now(), 5000, null);

-- ━━━ Columns and defaults ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select col_default_is('public', 'cashback_defaults', 'returning_vip_bps', '1000',
  'Returning VIP defaults to 10% for new places');
select throws_ok(
  $$update public.cashback_defaults set returning_vip_bps = 500 where id$$,
  '23514', null, 'Returning VIP picks are Off, 10% or 20%');

-- ━━━ Who is VIP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is((select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000e4766'),
  'regular', 'exactly 5,000 followers is Regular');
select is((select guest_class from public.consumers where id = '00000000-0000-4000-8000-0000000c4766'),
  'regular', 'the emulated count makes no VIP on screens (MESITA-4849)');
select ok(not public.consumer_is_vip_for_money('00000000-0000-4000-8000-0000000c4766', true),
  'live money ignores the emulator: 300 real followers is not VIP');
select ok(not public.consumer_is_vip_for_money('00000000-0000-4000-8000-0000000c4766', false),
  'test money ignores the emulator too (MESITA-4849)');
select ok(not public.consumer_is_vip_for_money('00000000-0000-4000-8000-0000000d4766', true),
  'live money: 6,000 real followers is not VIP (MESITA-4849)');

-- ━━━ The redeem ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.vip_invitation_codes (id, code_hash, code_last4, label) values
  ('00000000-0000-4000-8000-0000000c0de1', encode(sha256(convert_to('012345678901', 'UTF8')), 'hex'), '8901', 'probe one'),
  ('00000000-0000-4000-8000-0000000c0de2', encode(sha256(convert_to('111122223333', 'UTF8')), 'hex'), '3333', 'probe two');
insert into public.vip_invitation_codes (code_hash, code_last4, label, revoked_at) values
  (encode(sha256(convert_to('999988887777', 'UTF8')), 'hex'), '7777', 'probe revoked', now());

select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000a4766', '012345678901', true) ->> 'outcome',
  'joined', 'a fresh code (leading zero kept) makes the guest VIP');
select ok(
  (select vip_invited_at is not null and vip_invitation_code_id = '00000000-0000-4000-8000-0000000c0de1' and guest_class = 'vip'
     from public.consumers where id = '00000000-0000-4000-8000-0000000a4766'),
  'joined sets vip_invited_at and the code, and the class reads vip');
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '012345678901', true) ->> 'outcome',
  'invalid', 'a second guest with the same code gets invalid: one code, one VIP');
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '999988887777', true) ->> 'outcome',
  'invalid', 'a revoked code reads invalid too');
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000a4766', '111122223333', true) ->> 'outcome',
  'already_vip', 'an invited VIP is already VIP');
select ok((select used_at is null from public.vip_invitation_codes where id = '00000000-0000-4000-8000-0000000c0de2'),
  'already_vip leaves the code unused');
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000c4766', '111122223333', true) ->> 'outcome',
  'joined', 'a guest with followers is not already VIP and can use a code');
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-0000000b9999', '111122223333', true) ->> 'outcome',
  'consumer_not_found', 'an unknown guest is consumer_not_found');
select throws_ok(
  $$select public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '1234', true)$$,
  '22023', null, 'a code that is not twelve digits is refused before anything is counted');

do $$ begin
  for i in 1..8 loop
    perform public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '000000000000', true);
  end loop;
end $$;
select is(public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '000000000000', true) ->> 'outcome',
  'rate_limited', 'after 10 wrong codes in an hour the guest is rate limited');
select ok((select r between 1 and 3600 from (select (public.consumer_redeem_vip_invitation('00000000-0000-4000-8000-000000104766', '000000000000', true) ->> 'retry_after_seconds')::int as r) x),
  'rate_limited says when to try again');
select is((select count(*)::int from public.vip_invitation_attempts
            where consumer_id = '00000000-0000-4000-8000-000000104766' and outcome = 'rate_limited'),
  2, 'every rate-limited try is still logged');

-- ━━━ Remove VIP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select is(public.admin_remove_vip('00000000-0000-4000-8000-0000000d4766'), 'not_code_vip',
  'a guest without a code has no VIP to remove');
select is(public.admin_remove_vip('00000000-0000-4000-8000-0000000c4766'), 'removed',
  'a code-made VIP can be removed');
select ok((select vip_invited_at is null and guest_class = 'regular' from public.consumers where id = '00000000-0000-4000-8000-0000000c4766')
          and (select used_at is not null from public.vip_invitation_codes where id = '00000000-0000-4000-8000-0000000c0de2'),
  'removal clears the invite (the class reads regular) and the code stays used');

-- ━━━ Three Pay lines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

insert into public.place_profiles (id, google_name) values ('00000000-0000-4000-8000-000000014766', 'VIP Probe');
insert into public.places (id, slug, state, content_state, currency)
values ('00000000-0000-4000-8000-000000014766', 'mesita-4766-probe', 'active', 'generating', 'MXN');
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000014766', '00000000-0000-4000-8000-000000114766', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000014766', true);
insert into public.place_cashback_settings (place_id, welcome_bps, returning_bps, returning_vip_bps)
values ('00000000-0000-4000-8000-000000014766', 1000, 500, 2000);

create temp table bills (n int, consumer uuid, live boolean) on commit drop;
insert into bills values
  (1, '00000000-0000-4000-8000-0000000a4766', true),  -- invited: first bill
  (2, '00000000-0000-4000-8000-0000000a4766', true),  -- invited: later bill
  (3, '00000000-0000-4000-8000-0000000b4766', true),  -- regular: first
  (4, '00000000-0000-4000-8000-0000000b4766', true),  -- regular: later
  (5, '00000000-0000-4000-8000-0000000d4766', true),  -- real 6,000: first
  (6, '00000000-0000-4000-8000-0000000d4766', true),  -- real 6,000: later
  (7, '00000000-0000-4000-8000-0000000f4766', true),  -- emulated-only live: first
  (8, '00000000-0000-4000-8000-0000000f4766', true);  -- emulated-only live: later
update public.consumers set instagram_handle = 'probe_4766_g', instagram_verified_at = now(),
       instagram_followers_count = 300, instagram_followers_emulated = 6000
 where id = '00000000-0000-4000-8000-0000000f4766';

insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents, livemode)
select ('00000000-0000-4000-8000-000000' || lpad(b.n::text, 2, '0') || '4766')::uuid, '00000000-0000-4000-8000-000000014766',
       b.consumer, repeat(b.n::text, 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0,
       'waiter', now() + (b.n || ' minutes')::interval, 10000, 0, b.live
  from bills b order by b.n;

create function pg_temp.line(n int) returns text language sql as $$
  select reason || ':' || amount_cents from public.wallet_entries
   where tab_id = ('00000000-0000-4000-8000-000000' || lpad(n::text, 2, '0') || '4766')::uuid and kind = 'cashback' $$;

select is(pg_temp.line(1), 'welcome_vip:1000', 'a VIP''s first bill is Welcome VIP (MESITA-4789)');
select is(pg_temp.line(2), 'returning_vip:2000', 'an invited VIP''s later bill is Returning VIP');
select is(pg_temp.line(4), 'returning:500', 'a Regular''s later bill is Returning Regular');
select is(pg_temp.line(6), 'returning:500', 'a 6,000-follower guest''s later bill is Returning Regular (MESITA-4849)');
select is(pg_temp.line(8), 'returning:500', 'live money pays an emulator-only guest Returning Regular');

-- Test mode: the same emulator-only guest is paid as Regular; earlier live bills
-- do not spend Welcome in test mode.
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents, livemode)
values
  ('00000000-0000-4000-8000-000000094766', '00000000-0000-4000-8000-000000014766', '00000000-0000-4000-8000-0000000f4766',
   repeat('9', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0, 'waiter', now() + interval '20 minutes', 10000, 0, false),
  ('00000000-0000-4000-8000-000000104766', '00000000-0000-4000-8000-000000014766', '00000000-0000-4000-8000-0000000f4766',
   repeat('a', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0, 'waiter', now() + interval '21 minutes', 10000, 0, false);
select is(pg_temp.line(9), 'welcome:1000', 'test mode counts its own first bill: Welcome Regular');
select is(pg_temp.line(10), 'returning:500', 'test mode: the emulator makes no VIP (MESITA-4849)');

-- Off pays nothing.
update public.place_cashback_settings set returning_vip_bps = 0 where place_id = '00000000-0000-4000-8000-000000014766';
insert into public.pay_tabs (id, place_id, consumer_id, token_hash, currency, expires_at, status, bill_cents, tip_cents,
                             origin, paid_at, card_bill_cents, cash_bill_cents, livemode)
values ('00000000-0000-4000-8000-000000114766', '00000000-0000-4000-8000-000000014766', '00000000-0000-4000-8000-0000000a4766',
        repeat('b', 64), 'mxn', now() + interval '1 day', 'paid', 10000, 0, 'waiter', now() + interval '30 minutes', 10000, 0, true);
select is(pg_temp.line(11), null, 'Returning VIP Off: a VIP''s later bill earns nothing');

-- ━━━ Stories are gone ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

select throws_ok(
  $$insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, livemode)
    values ('00000000-0000-4000-8000-0000000a4766', '00000000-0000-4000-8000-000000014766', 'story', 2000, 'mxn', false)$$,
  '23514', null, 'nothing can write a new story entry');
select ok(
  to_regclass('public.story_mentions') is null
  and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname like 'story\_%')
  and not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'wallet_entries' and column_name = 'story_mention_id'),
  'story_mentions, the story RPCs and wallet_entries.story_mention_id are gone');

select * from finish();
rollback;
