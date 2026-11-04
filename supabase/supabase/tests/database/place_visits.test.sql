-- MESITA-3202, MESITA-3210 — Visits and Rewards: the discount, who qualifies,
-- that rewards add up, and the code.

begin;

create extension if not exists pgtap with schema public;

select plan(94);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-0000000a3202'),
  ('00000000-0000-4000-8000-0000000b3202');
insert into public.consumers (id, first_name) values
  ('00000000-0000-4000-8000-0000000a3202', 'Ana'),
  ('00000000-0000-4000-8000-0000000b3202', 'Beto');
update public.consumers set guest_class = 'vip' where id = '00000000-0000-4000-8000-0000000b3202';
update public.consumers set instagram_followers_count = 1500, instagram_verified_at = now()
 where id = '00000000-0000-4000-8000-0000000a3202';
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000003202', 'Visit Probe'),
  ('00000000-0000-4000-8000-000000013202', 'Other Probe');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000003202', 'mesita-3202-probe', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000013202', 'mesita-3202-other', 'active', 'generating', 'MXN');
insert into public.place_rewards (place_id, welcome_visit, returning_visit, instagram_story, vip_class, cap)
values ('00000000-0000-4000-8000-000000003202', true, true, true, false, false);

create function pg_temp.issue(guest text, code text) returns boolean language sql as $$
  select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', guest::uuid, code, now() + interval '10 minutes')
$$;
create function pg_temp.visit(code text, bill integer, reward text, req text) returns jsonb language sql as $$
  select public.place_visit_create('00000000-0000-4000-8000-000000003202', code, bill, 'cash',
    case when reward is null then '{}'::text[] else string_to_array(reward, ',') end, req::uuid,
    '00000000-0000-4000-8000-0000000a3202')
$$;

-- ━━━ EF-only ━━━

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.place_rewards'::regclass, 'public.place_visit_codes'::regclass, 'public.place_visits'::regclass))
    and not exists (select 1 from pg_policies where schemaname = 'public'
                     and tablename in ('place_rewards', 'place_visit_codes', 'place_visits')),
  'visit tables have RLS on and no policy'
);
select ok(
  not has_table_privilege('authenticated', 'public.place_visits', 'SELECT')
    and not has_table_privilege('anon', 'public.place_rewards', 'SELECT')
    and not has_table_privilege('authenticated', 'public.place_visit_codes', 'SELECT')
    and not has_function_privilege('authenticated',
      'public.place_visit_create(uuid, text, integer, text, text[], uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_rewards_for_guest(uuid, uuid)', 'EXECUTE'),
  'client roles hold nothing on visits or their functions'
);

-- ━━━ Who qualifies ━━━

select is(
  (select array_agg(kind) from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202')),
  array['welcome_visit', 'returning_visit', 'instagram_story'],
  'a switched-off reward is not offered, and the order is fixed'
);
select is(
  (select bool_or(eligible) from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', null)),
  false,
  'a signed-out read sees the offers, none eligible'
);

-- ━━━ The code ━━━

select ok(pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a'), 'a code is issued');
select is(pg_temp.issue('00000000-0000-4000-8000-0000000b3202', 'hash-a'), false, 'digits another guest holds are refused');
select is(
  public.place_visit_check('00000000-0000-4000-8000-000000013202', 'hash-a')->>'outcome', 'bad_code',
  'a code works only at the place it was made for'
);
select is(
  public.place_visit_check('00000000-0000-4000-8000-000000003202', 'hash-a')#>>'{guest,name}', 'Ana',
  'the place sees the name of the guest who showed the code'
);

-- ━━━ The money ━━━

select is(
  pg_temp.visit('hash-a', 12345, 'welcome_visit', '00000000-0000-4000-8000-00000000a001')#>>'{visit,discount_cents}', '2469',
  'Welcome Visit is 20%'
);
select is(
  (select (total_cents, currency, reward_percent)::text from public.place_visits
    where request_id = '00000000-0000-4000-8000-00000000a001'),
  '(9876,MXN,20)',
  'the total, the place''s currency and the percent are stored as they were'
);
select is(
  pg_temp.visit('hash-a', 99999, null, '00000000-0000-4000-8000-00000000a001')#>>'{visit,bill_cents}', '12345',
  'a repeated request returns the same visit'
);
select is(
  pg_temp.visit('hash-a', 500, null, '00000000-0000-4000-8000-00000000a002')->>'outcome', 'bad_code',
  'a spent code does not work twice'
);

-- ━━━ First visit, later visits ━━━

select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a2');
select is(
  pg_temp.visit('hash-a2', 1000, 'welcome_visit', '00000000-0000-4000-8000-00000000a003')->>'reason', 'not_first_visit',
  'Welcome Visit is refused after a first visit'
);
select is(
  public.place_visit_check('00000000-0000-4000-8000-000000003202', 'hash-a2')->>'outcome', 'ok',
  'a refused reward does not spend the code'
);
select is(
  pg_temp.visit('hash-a2', 1000, 'vip_class', '00000000-0000-4000-8000-00000000a004')->>'outcome', 'reward_off',
  'a reward the place switched off is refused'
);
select is(
  pg_temp.visit('hash-a2', 12345, 'returning_visit', '00000000-0000-4000-8000-00000000a005')#>>'{visit,discount_cents}', '1235',
  'Returning Visit is 10%, and half a cent rounds up'
);
select is(
  (select reason from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000b3202') where kind = 'returning_visit'),
  'first_visit',
  'Returning Visit is refused on a first visit'
);

-- ━━━ The cap ━━━

select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a3');
select is(
  pg_temp.visit('hash-a3', 200000, 'instagram_story', '00000000-0000-4000-8000-00000000a006')#>>'{visit,discount_cents}', '40000',
  'with the Cap off, 20% of 2,000 pesos is 400'
);
update public.place_rewards set cap = true where place_id = '00000000-0000-4000-8000-000000003202';
select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a4');
select is(
  pg_temp.visit('hash-a4', 200000, 'instagram_story', '00000000-0000-4000-8000-00000000a007')#>>'{visit,total_cents}', '180000',
  'with the Cap on, the discount stops at 200 pesos'
);
select is(
  public.place_rewards_read('00000000-0000-4000-8000-000000003202')->'cap',
  '{"cents": 20000, "enabled": true}'::jsonb,
  'the page reads the cap and its amount from the server'
);

-- ━━━ They add up ━━━

update public.place_rewards set cap = false where place_id = '00000000-0000-4000-8000-000000003202';
update public.consumers set guest_class = 'vip' where id = '00000000-0000-4000-8000-0000000a3202';
update public.place_rewards set vip_class = true where place_id = '00000000-0000-4000-8000-000000003202';
select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a5');
select is(
  pg_temp.visit('hash-a5', 100000, 'returning_visit,instagram_story,vip_class', '00000000-0000-4000-8000-00000000a008')#>>'{visit,discount_cents}', '50000',
  'Returning, Story and VIP add up to 50%'
);
select is(
  (select array_to_string(reward_kinds, ',') from public.place_visits where request_id = '00000000-0000-4000-8000-00000000a008'),
  'returning_visit,instagram_story,vip_class',
  'the visit keeps each reward it used'
);
select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a6');
select is(
  pg_temp.visit('hash-a6', 100000, 'welcome_visit,returning_visit', '00000000-0000-4000-8000-00000000a009')->>'outcome', 'not_eligible',
  'Welcome and Returning never meet on one visit'
);
select is(
  pg_temp.visit('hash-a6', 100000, 'instagram_story,made_up', '00000000-0000-4000-8000-00000000a010')->>'outcome', 'reward_off',
  'a reward nobody knows is refused'
);
update public.place_rewards set cap = true where place_id = '00000000-0000-4000-8000-000000003202';
select is(
  pg_temp.visit('hash-a6', 100000, 'returning_visit,instagram_story', '00000000-0000-4000-8000-00000000a011')#>>'{visit,discount_cents}', '20000',
  'the Cap limits the total, not each reward'
);
update public.consumers set guest_class = 'regular' where id = '00000000-0000-4000-8000-0000000a3202';
update public.place_rewards set vip_class = false, cap = false where place_id = '00000000-0000-4000-8000-000000003202';

-- ━━━ Voiding ━━━

select is(
  public.place_visit_void('00000000-0000-4000-8000-000000013202',
    (select id from public.place_visits where request_id = '00000000-0000-4000-8000-00000000a001'),
    '00000000-0000-4000-8000-0000000a3202')->>'outcome',
  'not_found',
  'a place cannot void another place''s visit'
);
select public.place_visit_void('00000000-0000-4000-8000-000000003202', v.id, '00000000-0000-4000-8000-0000000a3202')
  from public.place_visits v where v.consumer_id = '00000000-0000-4000-8000-0000000a3202';
select is(
  (select eligible from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202') where kind = 'welcome_visit'),
  true,
  'voiding every visit opens Welcome Visit again'
);

-- ━━━ VIP, expiry, a closed account ━━━

update public.place_rewards set vip_class = true where place_id = '00000000-0000-4000-8000-000000003202';
select is(
  (select array_agg(eligible order by kind) from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000b3202') where kind in ('vip_class')),
  array[true],
  'a VIP guest qualifies for VIP Class'
);
select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000b3202', 'hash-old', now() - interval '1 minute');
select is(
  public.place_visit_check('00000000-0000-4000-8000-000000003202', 'hash-old')->>'outcome', 'bad_code',
  'an expired code is refused'
);
select pg_temp.issue('00000000-0000-4000-8000-0000000b3202', 'hash-gone');
update public.consumers set deleted_at = now() where id = '00000000-0000-4000-8000-0000000b3202';
select is(
  public.place_visit_check('00000000-0000-4000-8000-000000003202', 'hash-gone')->>'outcome', 'bad_code',
  'a closed account''s code is refused'
);

-- ━━━ Story's follower bar (MESITA-3224) ━━━

create function pg_temp.story(guest text) returns text language sql as $$
  select coalesce(eligible::text, 'null') || ':' || coalesce(reason, 'none')
    from public.place_rewards_for_guest('00000000-0000-4000-8000-000000003202', guest::uuid)
   where kind = 'instagram_story'
$$;

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000c3202');
insert into public.consumers (id, first_name) values ('00000000-0000-4000-8000-0000000c3202', 'Caro');

select is(pg_temp.story('00000000-0000-4000-8000-0000000c3202'), 'false:instagram_not_connected',
  'no Instagram, no Story');
update public.consumers set instagram_followers_count = 5000 where id = '00000000-0000-4000-8000-0000000c3202';
select is(pg_temp.story('00000000-0000-4000-8000-0000000c3202'), 'false:instagram_not_connected',
  'a count on an account nobody verified does not count');
update public.consumers set instagram_followers_count = null, instagram_verified_at = now() where id = '00000000-0000-4000-8000-0000000c3202';
select is(pg_temp.story('00000000-0000-4000-8000-0000000c3202'), 'false:instagram_not_connected',
  'a verified account with no count is not zero, and is not eligible');
update public.consumers set instagram_followers_count = 999 where id = '00000000-0000-4000-8000-0000000c3202';
select is(pg_temp.story('00000000-0000-4000-8000-0000000c3202'), 'false:not_enough_followers',
  '999 followers is under the bar');
update public.consumers set instagram_followers_count = 1000 where id = '00000000-0000-4000-8000-0000000c3202';
select is(pg_temp.story('00000000-0000-4000-8000-0000000c3202'), 'true:none',
  '1,000 followers clears the bar');

update public.consumers set instagram_followers_count = 999 where id = '00000000-0000-4000-8000-0000000c3202';
select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000c3202', 'hash-c', now() + interval '10 minutes');
select is(
  pg_temp.visit('hash-c', 100000, 'instagram_story', '00000000-0000-4000-8000-00000000c001') - 'visit',
  '{"outcome": "not_eligible", "reason": "not_enough_followers"}'::jsonb,
  'the till refuses Story under the bar'
);
select is(
  pg_temp.visit('hash-c', 100000, 'welcome_visit,instagram_story', '00000000-0000-4000-8000-00000000c002')->>'outcome', 'not_eligible',
  'one bad pick refuses the visit; the discount never quietly shrinks'
);
select is(
  (select count(*)::integer from public.place_visits where consumer_id = '00000000-0000-4000-8000-0000000c3202'), 0,
  'a refused visit writes nothing'
);

-- ━━━ The Cap starts on (MESITA-3224) ━━━

select is(
  public.place_rewards_read('00000000-0000-4000-8000-000000013202')#>>'{cap,enabled}', 'true',
  'a place with no row reads the Cap on'
);
insert into public.place_rewards (place_id, welcome_visit) values ('00000000-0000-4000-8000-000000013202', true);
select is(
  public.place_rewards_read('00000000-0000-4000-8000-000000013202')#>>'{cap,enabled}', 'true',
  'a place''s first switch leaves the Cap on'
);

-- ━━━ Closing at visit.mesita.ai (MESITA-3240) ━━━

select is(
  public.place_visit_close('00000000-0000-4000-8000-000000013202', 'hash-any', 'pc-any', 50000, '{}', '00000000-0000-4000-8000-00000000c100')->>'outcome',
  'no_place_code',
  'a place with no code set closes nothing'
);

update public.place_rewards set place_code_hash = 'pc-right' where place_id = '00000000-0000-4000-8000-000000003202';
create function pg_temp.close(code text, digits text, req text) returns jsonb language sql as $$
  select public.place_visit_close('00000000-0000-4000-8000-000000003202', code, digits, 50000, '{}', req::uuid)
$$;

select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-c')
    - 'expires_at' - 'opened_at',
  '{"outcome": "ok", "guest_name": "Caro", "bill_cents": null, "bill_confirmed_at": null, "place_name": "Visit Probe",
    "currency": "MXN", "code_set": true, "story": false, "story_offered": false, "task_seen_at": null, "task_skipped_at": null,
    "rewards": [{"kind": "welcome_visit", "percent": 20, "cap_cents": null}], "quote": null, "quote_with_story": null, "step": "bill"}'::jsonb,
  'the page gets a first name, only the rewards this guest can use, and an open visit at the bill step, never a member number'
);

-- ━━━ The shared visit (MESITA-3270) ━━━

select ok(
  (select vc.opened_at is not null and vc.expires_at > now() + interval '50 minutes'
     from public.place_visit_codes vc where vc.code_hash = 'hash-c'),
  'the scan stamps the visit open and gives the table an hour'
);
select is(
  public.place_visit_state_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000c3202')->>'step',
  'bill',
  'the guest reads the same open visit by account, without the secret'
);
select is(
  public.place_visit_state_for_guest('00000000-0000-4000-8000-000000013202', '00000000-0000-4000-8000-0000000c3202')->>'outcome',
  'none',
  'a guest with no open visit at a place reads none'
);
select is(
  pg_temp.close('hash-c', 'pc-right', '00000000-0000-4000-8000-00000000c0a0')->>'outcome', 'bill_not_confirmed',
  'the till cannot close a visit with no bill on it'
);
select is(
  public.place_visit_set_bill('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-wrong', 100)->>'outcome',
  'wrong_place_code',
  'the guest holds the link too, so the link alone cannot write the bill'
);
select is(
  (select bill_cents from public.place_visit_codes where code_hash = 'hash-c'), null::integer,
  'a refused bill writes nothing'
);
select ok(
  (select vc.expires_at from public.place_visit_codes vc where vc.code_hash = 'hash-c')
    = (select (public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-c')->>'expires_at')::timestamptz),
  'reading an open visit again does not extend it'
);
select is(
  public.place_visit_set_bill('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 50000)->'quote',
  '{"percent": 20, "discount_cents": 10000, "total_cents": 40000}'::jsonb,
  'staff type the bill and both phones read what it costs with the rewards that count'
);
select is(
  public.place_visit_confirm_bill('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000c3202', 49900)->>'outcome',
  'bill_changed',
  'the guest cannot confirm a number that is not the one on the row'
);
select is(
  pg_temp.close('hash-c', 'pc-right', '00000000-0000-4000-8000-00000000c0a1')->>'outcome', 'bill_not_confirmed',
  'a bill the guest has not confirmed does not close'
);
select is(
  public.place_visit_confirm_bill('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000c3202', 50000)->>'step',
  'pay',
  'the guest confirms the bill, and with no Story offered the visit is at pay'
);
select is(
  public.place_visit_set_bill('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 60000)->>'bill_confirmed_at',
  null,
  'a bill staff change needs the guest''s confirmation again'
);
select is(
  public.place_visit_close('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 60000, '{}', '00000000-0000-4000-8000-00000000c0a2')->>'outcome',
  'bill_not_confirmed',
  'the changed bill does not close until the guest confirms it'
);
select public.place_visit_set_bill('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 50000);
select is(
  public.place_visit_set_bill('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 50000)->>'bill_confirmed_at',
  null,
  'a bill set back to the old number is still unconfirmed'
);
select public.place_visit_confirm_bill('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000c3202', 50000);
select is(
  public.place_visit_close('00000000-0000-4000-8000-000000003202', 'hash-c', 'pc-right', 49000, '{}', '00000000-0000-4000-8000-00000000c0a3')->>'outcome',
  'bill_not_confirmed',
  'the till logs the confirmed number and no other'
);

select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202', 'hash-billed', now() + interval '10 minutes', 125000);
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-billed')->>'bill_cents', '125000',
  'a bill already on the row reaches the page'
);
select public.place_visit_confirm_bill('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202', 125000);
select is(
  public.place_visit_close('00000000-0000-4000-8000-000000003202', 'hash-billed', 'pc-right', 125000, '{}', '00000000-0000-4000-8000-00000000c0b1')#>>'{visit,bill_cents}', '125000',
  'the confirmed bill is the one logged'
);
select is(
  public.place_visit_state_for_guest('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202')->>'outcome',
  'none',
  'the close ends the open visit on the guest''s side too'
);
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-nope'),
  '{"outcome": "bad_code"}'::jsonb,
  'a QR that has ended shows nothing'
);

select is(
  pg_temp.close('hash-nope', 'pc-right', '00000000-0000-4000-8000-00000000c101')->>'outcome', 'bad_code',
  'a QR that has ended closes nothing, even with the right number'
);
select is(
  pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c102')->>'outcome', 'wrong_place_code',
  'a wrong number is refused'
);
select pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c102');
select pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c102');
select pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c102');
select is(
  pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c102')->>'outcome', 'locked',
  'the fifth wrong number in a row locks this guest here'
);
select is(
  pg_temp.close('hash-c', 'pc-right', '00000000-0000-4000-8000-00000000c103')->>'outcome', 'locked',
  'the right number waits out the lock'
);
select is(
  (select count(*)::integer from public.place_visits where consumer_id = '00000000-0000-4000-8000-0000000c3202'), 0,
  'no refused try logs a visit'
);
select pg_temp.issue('00000000-0000-4000-8000-0000000a3202', 'hash-a9');
select is(
  pg_temp.close('hash-a9', 'pc-wrong', '00000000-0000-4000-8000-00000000c104')->>'outcome', 'wrong_place_code',
  'one guest''s lock does not touch another guest at the till'
);

update public.place_code_tries set locked_until = now() - interval '1 minute'
 where consumer_id = '00000000-0000-4000-8000-0000000c3202';
select is(
  pg_temp.close('hash-c', 'pc-right', '00000000-0000-4000-8000-00000000c105')->>'outcome', 'ok',
  'after the lock, the right number closes the visit'
);
select is(
  (select jsonb_build_object('method', payment_method, 'by', created_by, 'total', total_cents)
     from public.place_visits where request_id = '00000000-0000-4000-8000-00000000c105'),
  '{"method": null, "by": null, "total": 50000}'::jsonb,
  'the visit holds the amount, with no payment method and nobody signed in'
);
select is(
  (select count(*)::integer from public.place_code_tries where consumer_id = '00000000-0000-4000-8000-0000000c3202'), 0,
  'the right number clears the wrong tries'
);
select is(
  pg_temp.close('hash-c', 'pc-right', '00000000-0000-4000-8000-00000000c105')->>'replayed', 'true',
  'a retried tap returns the same visit, though the guest''s code is spent'
);
select is(
  pg_temp.close('hash-c', 'pc-wrong', '00000000-0000-4000-8000-00000000c105')->>'outcome', 'bad_code',
  'a retry without the right number learns nothing about the visit'
);
select ok(
  not has_table_privilege('authenticated', 'public.place_code_tries', 'SELECT')
    and not has_table_privilege('anon', 'public.place_code_tries', 'SELECT')
    and not has_function_privilege('anon', 'public.place_visit_open(uuid, text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_visit_state(uuid, text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_visit_state_for_guest(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_visit_confirm_bill(uuid, uuid, integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_visit_skip_task(uuid, uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_visit_set_bill(uuid, text, text, integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_visit_set_task(uuid, text, text, boolean)', 'EXECUTE')
    and not has_function_privilege('anon',
      'public.place_visit_close(uuid, text, text, integer, text[], uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated',
      'public.place_visit_close(uuid, text, text, integer, text[], uuid)', 'EXECUTE'),
  'client roles hold nothing on closing a visit'
);

-- MESITA-3259 then MESITA-3270: Story counts only once staff saw it, at the Task step.
select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202', 'hash-unticked', now() + interval '10 minutes', 100000);
select public.place_visit_confirm_bill('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202', 100000);
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-unticked') - 'rewards' - 'expires_at' - 'opened_at' - 'bill_confirmed_at'
    - 'guest_name' - 'place_name' - 'currency' - 'code_set' - 'task_seen_at' - 'task_skipped_at',
  '{"outcome": "ok", "bill_cents": 100000, "story": false, "story_offered": true, "step": "task",
    "quote": {"percent": 10, "discount_cents": 10000, "total_cents": 90000},
    "quote_with_story": {"percent": 30, "discount_cents": 30000, "total_cents": 70000}}'::jsonb,
  'a Story on offer is a task step, and both phones read what the bill costs with and without it'
);
select ok(
  not (public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-unticked')->'rewards' @> '[{"kind": "instagram_story"}]'::jsonb),
  'a Story nobody saw does not count, even for a guest who could use it'
);
select is(
  public.place_visit_close('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-right', 100000, '{instagram_story}', '00000000-0000-4000-8000-00000000d001')->>'reason',
  'story_not_seen',
  'the close refuses a Story staff did not see'
);
select is(
  (select count(*)::integer from public.place_visits where request_id = '00000000-0000-4000-8000-00000000d001'), 0,
  'a refused Story logs no visit'
);
select is(
  public.place_visit_set_task('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-wrong', true)->>'outcome',
  'wrong_place_code',
  'the guest holds the link too, so the link alone cannot say the Story was seen'
);
select is(
  public.place_visit_skip_task('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202')->>'step',
  'pay',
  'the guest passes on the Story and the visit moves to pay'
);
select is(
  public.place_visit_set_task('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-right', true) - 'expires_at' - 'opened_at' - 'bill_confirmed_at'
    - 'guest_name' - 'place_name' - 'currency' - 'code_set' - 'task_seen_at' - 'task_skipped_at' - 'quote_with_story' - 'bill_cents' - 'story_offered',
  '{"outcome": "ok", "story": true, "step": "pay",
    "rewards": [{"kind": "returning_visit", "percent": 10, "cap_cents": null}, {"kind": "instagram_story", "percent": 20, "cap_cents": null}],
    "quote": {"percent": 30, "discount_cents": 30000, "total_cents": 70000}}'::jsonb,
  'staff saw the Story: it counts, and the quote says so'
);
select is(
  public.place_visit_skip_task('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202')->>'story',
  'true',
  'the guest cannot undo a Story staff already saw'
);
select is(
  public.place_visit_set_task('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-right', false)->>'story',
  'false',
  'staff can take a Story back off'
);
select public.place_visit_set_task('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-right', true);
select is(
  public.place_visit_close('00000000-0000-4000-8000-000000003202', 'hash-unticked', 'pc-right', 100000, '{returning_visit,instagram_story}', '00000000-0000-4000-8000-00000000d002')#>>'{visit,discount_cents}',
  '30000',
  'a Story staff saw comes off the bill'
);

-- MESITA-3262: the QR won't scan, so staff type the member number and the place code.
update public.consumers set code = '3202-0001' where id = '00000000-0000-4000-8000-0000000a3202';
select public.place_visit_code_issue('00000000-0000-4000-8000-000000003202', '00000000-0000-4000-8000-0000000a3202', 'hash-typed', now() + interval '10 minutes', 120000);
create function pg_temp.typed(digits text, new_hash text) returns jsonb language sql as $$
  select public.place_visit_member_claim('3202-0001', jsonb_build_array(jsonb_build_object(
    'place_id', '00000000-0000-4000-8000-000000003202', 'place_code_hash', digits, 'new_code_hash', new_hash)))
$$;
select ok(
  public.place_visit_member_places('3202-0001') @> array['00000000-0000-4000-8000-000000003202'::uuid],
  'a member number finds the place of an open QR'
);
select is(pg_temp.typed('pc-wrong', 'hash-new')->>'outcome', 'no_match', 'a member number with the wrong place code opens nothing');
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-typed')->>'outcome', 'ok',
  'a wrong try leaves the scanned QR working'
);
select is(public.place_visit_member_claim('9999-9999', '[]'::jsonb)->>'outcome', 'no_match', 'an unknown member reads the same as wrong digits');
select pg_temp.typed('pc-wrong', 'hash-new');
select pg_temp.typed('pc-wrong', 'hash-new');
select pg_temp.typed('pc-wrong', 'hash-new');
select is(pg_temp.typed('pc-wrong', 'hash-new')->>'outcome', 'locked', 'five wrong tries lock typing for that guest');
select is(pg_temp.typed('pc-right', 'hash-new')->>'outcome', 'locked', 'the right digits wait out the lock');
select is(
  (select count(*)::integer from public.place_code_tries
    where place_id = '00000000-0000-4000-8000-000000003202' and consumer_id = '00000000-0000-4000-8000-0000000a3202'),
  0,
  'typing wrong codes never counts against the guest''s scanned QR'
);
delete from public.visit_member_tries where consumer_id = '00000000-0000-4000-8000-0000000a3202';
select is(
  pg_temp.typed('pc-right', 'hash-new')->>'place_id', '00000000-0000-4000-8000-000000003202',
  'both codes right opens the visit'
);
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-typed')->>'outcome', 'bad_code',
  'the old secret ends when the codes open the visit'
);
select is(
  public.place_visit_open('00000000-0000-4000-8000-000000003202', 'hash-new')->>'bill_cents', '120000',
  'the new secret holds the guest''s bill'
);
select ok(
  not has_table_privilege('authenticated', 'public.visit_member_tries', 'SELECT')
    and not has_table_privilege('anon', 'public.visit_member_tries', 'SELECT')
    and not has_function_privilege('anon', 'public.place_visit_member_places(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_visit_member_places(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.place_visit_member_claim(text, jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.place_visit_member_claim(text, jsonb)', 'EXECUTE'),
  'client roles hold nothing on typing the codes'
);

select * from finish();
rollback;
