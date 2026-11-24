-- MESITA-4858 — a handle is saved unverified; only a live, single-use code from
-- the matching account verifies it; VIP needs consent, proof, a public account
-- and more than 5,000 followers.

begin;

create extension if not exists pgtap with schema public;

select plan(22);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a4858'),
  ('00000000-0000-4000-8000-0000000b4858');
insert into public.consumers (id, first_name, birth_year) values
  ('00000000-0000-4000-8000-0000000a4858', 'Ana', 1990),
  ('00000000-0000-4000-8000-0000000b4858', 'Bea', 1990);

create function pg_temp.ana() returns public.consumers language sql as
  $$ select c from public.consumers c where id = '00000000-0000-4000-8000-0000000a4858' $$;
create function pg_temp.code(p_code text, p_vip boolean, p_age interval default '0') returns void language sql as $$
  insert into public.consumer_instagram_claims (consumer_id, handle, code, vip_check, created_at)
  values ('00000000-0000-4000-8000-0000000a4858', 'ana.4858', p_code, p_vip, now() - p_age)
  on conflict (consumer_id) do update set code = excluded.code, vip_check = excluded.vip_check,
    created_at = excluded.created_at, failed_reason = null $$;

select is(public.consumer_instagram_set_handle('00000000-0000-4000-8000-0000000a4858', 'ana.4858'), false, 'a new handle starts hidden');
select ok((pg_temp.ana()).instagram_proved_at is null, 'and unverified');
select is(public.consumer_instagram_set_handle('00000000-0000-4000-8000-0000000a4858', 'ana.4858', true), true, 'it can be shared unverified');
select is(public.consumer_social_level(pg_temp.ana()), 'public', 'and never shows to other guests (MESITA-4863)');

select is(public.consumer_instagram_prove('MESITA-NOCODE', 'ana.4858'), 'unknown', 'an unknown code proves nothing');
select pg_temp.code('MESITA-AAAAA2', true, '16 minutes');
select is(public.consumer_instagram_prove('MESITA-AAAAA2', 'ana.4858', 9000, false), 'expired', 'an expired code');
select pg_temp.code('MESITA-AAAAA3', false);
select is(public.consumer_instagram_prove('MESITA-AAAAA3', 'someone.else', 9000, false), 'wrong_account', 'the wrong account');
select is((select failed_reason from public.consumer_instagram_claims where code = 'MESITA-AAAAA3'), 'wrong_account', 'the app can say why');
select ok((pg_temp.ana()).instagram_proved_at is null, 'none of them verified the handle');

select is(public.consumer_instagram_prove('MESITA-AAAAA3', 'ana.4858', 9000, false), 'verified', 'the right account retries the same code');
select ok((pg_temp.ana()).instagram_proved_at is not null and (pg_temp.ana()).instagram_followers_count is null
  and (pg_temp.ana()).instagram_vip_status is null and (pg_temp.ana()).guest_class = 'regular',
  'no consent: verified, and no count kept');
select is(public.consumer_instagram_prove('MESITA-AAAAA3', 'ana.4858'), 'unknown', 'a code works once');

select pg_temp.code('MESITA-AAAAA4', true);
select public.consumer_instagram_prove('MESITA-AAAAA4', 'ana.4858', 5000, false);
select is((pg_temp.ana()).instagram_vip_status, 'not_enough', 'exactly 5,000 does not qualify');
select pg_temp.code('MESITA-AAAAA5', true);
select public.consumer_instagram_prove('MESITA-AAAAA5', 'ana.4858', 5001, null);
select ok((pg_temp.ana()).instagram_vip_status = 'unconfirmed' and (pg_temp.ana()).guest_class = 'regular'
  and (pg_temp.ana()).instagram_proved_at is not null, 'public not known: unconfirmed, the badge stays');
select pg_temp.code('MESITA-AAAAA6', true);
select public.consumer_instagram_prove('MESITA-AAAAA6', 'ana.4858', null, false);
select is((pg_temp.ana()).instagram_vip_status, 'unconfirmed', 'no count: unconfirmed');
select pg_temp.code('MESITA-AAAAA7', true);
select public.consumer_instagram_prove('MESITA-AAAAA7', 'ana.4858', 5001, true);
select is((pg_temp.ana()).instagram_vip_status, 'not_public', 'a private account does not qualify');
select pg_temp.code('MESITA-AAAAA8', true);
select public.consumer_instagram_prove('MESITA-AAAAA8', 'ana.4858', 5001, false);
select ok((pg_temp.ana()).guest_class = 'vip'
  and public.consumer_is_vip_for_money('00000000-0000-4000-8000-0000000a4858', true), 'public with 5,001: VIP, for money too');

select is(public.consumer_instagram_set_handle('00000000-0000-4000-8000-0000000b4858', 'ana.4858', true), false,
  'a handle another guest verified is saved but never shared');
select throws_ok(
  $$ update public.consumers set instagram_handle_shown = true where id = '00000000-0000-4000-8000-0000000b4858' $$,
  'P0001', 'handle_proved_elsewhere', 'nor switched on later');

select pg_temp.code('MESITA-AAAAA9', true);
select public.consumer_instagram_set_handle('00000000-0000-4000-8000-0000000a4858', 'ana.new');
select ok((pg_temp.ana()).instagram_proved_at is null and (pg_temp.ana()).guest_class = 'regular'
  and (pg_temp.ana()).instagram_followers_count is null and (pg_temp.ana()).instagram_handle_shown is false,
  'a new handle clears the badge, the VIP and the choice');
select is((select count(*)::int from public.consumer_instagram_claims where consumer_id = '00000000-0000-4000-8000-0000000a4858'), 0,
  'and the pending code');

select ok(
  not has_function_privilege('authenticated', 'public.consumer_instagram_set_handle(uuid, text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consumer_instagram_prove(text, text, integer, boolean)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consumer_instagram_prove(text, text, integer, boolean)', 'EXECUTE'),
  'client roles run neither');

select * from finish();
rollback;
