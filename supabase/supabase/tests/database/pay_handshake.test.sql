-- MESITA-4889 — the pay handshake: the guest's Pay and the waiter's Receive, in
-- any order, close the same bill the same way, with or without cashback, credit
-- and tip; alone neither does; a changed bill clears the waiter's tap.
begin;
create extension if not exists pgtap with schema public;
select plan(71);

insert into auth.users (id) values ('00000000-0000-4000-8000-0000000f4889');
insert into public.place_profiles (id, google_name) values
  ('00000000-0000-4000-8000-000000014889', 'Hand Plain'), ('00000000-0000-4000-8000-000000024889', 'Hand Cashback'),
  ('00000000-0000-4000-8000-000000034889', 'Hand Nothing');
insert into public.places (id, slug, state, content_state, currency) values
  ('00000000-0000-4000-8000-000000014889', 'mesita-4889-d', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000024889', 'mesita-4889-c', 'active', 'generating', 'MXN'),
  ('00000000-0000-4000-8000-000000034889', 'mesita-4889-n', 'active', 'generating', 'MXN');
-- The first place has rates but no Credits Agreement, so it earns nothing; the
-- second earns cashback (Discount is gone, MESITA-5076).
insert into public.place_cashback_settings (place_id, welcome_bps, returning_bps) values
  ('00000000-0000-4000-8000-000000014889', 1000, 1000),
  ('00000000-0000-4000-8000-000000024889', 1000, 1000);
insert into public.loyalty_cards_contracts (place_id, signed_by, signer_role, terms_version, text_sha256)
values ('00000000-0000-4000-8000-000000024889', '00000000-0000-4000-8000-0000000f4889', 'owner', 'draft-2026-11', repeat('0', 64));
insert into public.place_payment_settings (place_id, loyalty_cards) values ('00000000-0000-4000-8000-000000024889', true);
insert into public.place_waiters (id, place_id, name, lookup_hash)
select ('00000000-0000-4000-8000-0000000' || n || '4890')::uuid, ('00000000-0000-4000-8000-0000000' || n || '4889')::uuid,
       'W' || n, repeat(md5('hand' || n), 2)
  from generate_series(1, 3) n;

-- A new guest with MX$220 of credit (or none) and a sent bill.
create function pg_temp.sent(p_n integer, p_place uuid, p_credit boolean, p_bill integer, p_tip integer)
returns public.pay_bills language plpgsql as $$
declare
  g uuid := ('00000000-0000-4000-8000-0000' || lpad(p_n::text, 4, '0') || '4889')::uuid;
  h text := repeat(md5('qr' || p_n), 2);
  o jsonb;
  b public.pay_bills;
begin
  insert into auth.users (id) values (g);
  insert into public.consumers (id, first_name) values (g, 'Guest') on conflict do nothing;
  if p_credit then
    insert into public.wallet_purchases (id, consumer_id, place_id, amount_cents, currency, status, stripe_account_id,
                                         voucher, bonus_cents, application_fee_cents, stripe_checkout_session_id)
    values (g, g, p_place, 20000, 'mxn', 'open', 'acct_test_4889', 'voucher_200', 2000, 1000, 'cs_test_4889_' || p_n);
    perform public.wallet_credit_purchase(g, 'pi_test_4889_' || p_n, now() - interval '1 minute');
  end if;
  perform public.pay_guest_code_set(g, h);
  o := public.pay_bill_open(h, null, p_place, 'mxn', false, repeat('d', 64));
  perform public.pay_bill_send((o->>'bill_id')::uuid, p_place, 0, p_bill, p_tip, repeat('d', 64), 15, now(),
    (select id from public.place_waiters where place_id = p_place),
    (select name from public.place_waiters where place_id = p_place));
  select * into b from public.pay_bills where id = (o->>'bill_id')::uuid;
  return b;
end $$;
create function pg_temp.pay(b public.pay_bills, p_version integer default 1) returns jsonb language sql as $$
  select public.pay_bill_accept(b.id, b.consumer_id, p_version, repeat(md5('tok' || b.id::text), 2)); $$;
create function pg_temp.take(b public.pay_bills, p_version integer default 1) returns jsonb language sql as $$
  select public.pay_bill_receive(b.id, b.place_id, p_version, repeat('e', 64),
    (select id from public.place_waiters where place_id = b.place_id)); $$;
-- What a bill came to.
create function pg_temp.came(p_bill uuid) returns text language sql as $$
  select concat_ws('|', a.status, t.credit_cents, t.cash_bill_cents, t.cash_tip_cents,
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries e where e.consumer_id = a.consumer_id and e.kind = 'spend'),
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback'),
    t.waiter_name)
  from public.pay_bills b join public.guest_pay_attempts a on a.id = b.attempt_id
  left join public.pay_tabs t on t.id = a.tab_id where b.id = p_bill; $$;

-- ── Every place × credit × tip, both orders: 18 × 2 ──
create temp table m (n integer, place uuid, credit boolean, bill integer, tip integer, first text, got text, alone text, want text);
insert into m (n, place, credit, bill, tip, first, want)
select (row_number() over ())::integer, p.id, c.credit, c.bill, t.tip, f.first,
       concat_ws('|', 'closed', d.cred, c.bill - d.cred, t.tip, -d.cred,
         case when p.k = 2 then (c.bill - d.cred) / 10 else 0 end, 'W' || p.k)
  from (values (1, '00000000-0000-4000-8000-000000014889'::uuid), (2, '00000000-0000-4000-8000-000000024889'::uuid), (3, '00000000-0000-4000-8000-000000034889'::uuid)) p(k, id)
  cross join (values (false, 50000), (true, 50000), (true, 10000)) c(credit, bill)
  cross join (values (0), (1000)) t(tip)
  cross join (values ('guest'), ('waiter')) f(first)
  cross join lateral (select case when c.credit then least(22000, c.bill) else 0 end as cred) d;
-- The third place gives nothing: its rates are zero whatever the defaults are.
insert into public.place_cashback_settings (place_id, welcome_bps, returning_bps)
values ('00000000-0000-4000-8000-000000034889', 0, 0);
do $$
declare r record; b public.pay_bills;
begin
  for r in select * from m order by n loop
    b := pg_temp.sent(r.n, r.place, r.credit, r.bill, r.tip);
    if r.first = 'guest' then perform pg_temp.pay(b); else perform pg_temp.take(b); end if;
    update m set alone = case when exists (select 1 from public.pay_tabs t where t.consumer_id = b.consumer_id and t.status = 'paid') then 'paid' else 'waits' end where n = r.n;
    if r.first = 'guest' then perform pg_temp.take(b); else perform pg_temp.pay(b); end if;
    update m set got = pg_temp.came(b.id) where n = r.n;
  end loop;
end $$;
select is(m.alone || ' ' || m.got, 'waits ' || m.want,
  format('%s bill %s credit %s tip %s, %s first', m.place, m.bill, m.credit, m.tip, m.first)) from m order by n;

-- ── The edges ──
create temp table s (k text primary key, b public.pay_bills);
insert into s select 'edit', pg_temp.sent(101, '00000000-0000-4000-8000-000000014889', true, 50000, 1000);
select is((select pg_temp.take(b)->>'outcome' from s where k = 'edit'), 'ready', 'the waiter taps first');
select is((select pg_temp.take(b)->>'outcome' from s where k = 'edit'), 'ready', 'twice is once');
select is((select public.pay_bill_receive((b).id, '00000000-0000-4000-8000-000000024889', 1, repeat('e', 64), null)->>'code' from s where k = 'edit'), 'forbidden', 'never another place');
select is((select took_cents from public.pay_bills where id = (select (b).id from s where k = 'edit')), 29000, 'what they took is kept');
select is((select public.pay_bill_send((b).id, (b).place_id, 1, 60000, 1000, repeat('d', 64))->>'version' from s where k = 'edit'), '2', 'the bill is edited');
select is((select received_version from public.pay_bills where id = (select (b).id from s where k = 'edit')), null, 'an edit clears the tap');
select is((select pg_temp.take(b)->>'code' from s where k = 'edit'), 'stale', 'the old numbers are not received');
select is((select pg_temp.pay(b)->>'code' from s where k = 'edit'), 'quote_changed', 'nor paid');
select is((select pg_temp.pay(b, 2)->>'status' from s where k = 'edit'), 'due', 'the new ones wait for the waiter');
select is((select public.pay_bill_unreceive((b).id, (b).place_id)->>'code' from s where k = 'edit'), 'accepted', 'nothing is undone after Pay');
select is((select pg_temp.take(b, 2)->>'outcome' from s where k = 'edit'), 'paid', 'and then both coincide');
select is((select pg_temp.take(b, 2)->>'outcome' from s where k = 'edit'), 'paid', 'a third tap moves nothing');
select is((select count(*)::int from public.pay_tabs where consumer_id = (select (b).consumer_id from s where k = 'edit')), 1, 'one ticket');

insert into s select 'undo', pg_temp.sent(102, '00000000-0000-4000-8000-000000024889', false, 50000, 0);
select is((select pg_temp.take(b)->>'outcome' from s where k = 'undo'), 'ready', 'tapped');
select is((select public.pay_bill_unreceive((b).id, (b).place_id)->>'outcome' from s where k = 'undo'), 'undone', 'and taken back');
select is((select took_cents from public.pay_bills where id = (select (b).id from s where k = 'undo')), null, 'nothing was taken');
select is((select pg_temp.pay(b)->>'status' from s where k = 'undo'), 'due', 'Pay alone does not close it');
select is((select public.pay_guest_claim_end(attempt_id, 'cancelled')->>'outcome' from public.pay_bills where id = (select (b).id from s where k = 'undo')), 'claimed', 'the guest cancels');
select is((select pg_temp.take(b)->>'code' from s where k = 'undo'), 'already_final', 'a bill being cancelled is not received');

insert into s select 'drift', pg_temp.sent(103, '00000000-0000-4000-8000-000000024889', false, 50000, 0);
select is((select pg_temp.take(b)->>'outcome' from s where k = 'drift'), 'ready', 'tapped at 10% cashback');
update public.place_cashback_settings set welcome_bps = 2000 where place_id = '00000000-0000-4000-8000-000000024889';
select is((select pg_temp.pay(b)->>'code' from s where k = 'drift'), 'quote_changed', 'the offer changed');
select is((select concat_ws('|', version, coalesce(received_version::text, 'none'), took_cents) from public.pay_bills where id = (select (b).id from s where k = 'drift')), '2|none|50000', 'both tap again; what was taken is remembered');

insert into s select 'gone', pg_temp.sent(104, '00000000-0000-4000-8000-000000024889', false, 50000, 0);
select is((select pg_temp.take(b)->>'outcome' from s where k = 'gone'), 'ready', 'tapped');
select is((select public.pay_bill_decline((b).id, (b).consumer_id, 1)->>'outcome' from s where k = 'gone'), 'declined', 'the guest declines');
select is((select concat_ws('|', coalesce(received_version::text, 'none'), took_cents) from public.pay_bills where id = (select (b).id from s where k = 'gone')), 'none|50000', 'the tap is gone, the money is not forgotten');

insert into s select 'fired', pg_temp.sent(105, '00000000-0000-4000-8000-000000034889', false, 50000, 0);
select is((select pg_temp.take(b)->>'outcome' from s where k = 'fired'), 'ready', 'tapped');
update public.place_waiters set removed_at = now(), lookup_hash = null where place_id = '00000000-0000-4000-8000-000000034889';
select is((select pg_temp.pay(b)->>'status' from s where k = 'fired'), 'due', 'a removed waiter''s tap counts for nothing');

select ok(not has_function_privilege('authenticated', 'public.pay_bill_receive(uuid, uuid, integer, text, uuid, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.pay_bill_unreceive(uuid, uuid, timestamptz)', 'execute'), 'clients never call them');
insert into s select 'late', pg_temp.sent(106, '00000000-0000-4000-8000-000000024889', false, 50000, 0);
select is((select public.pay_bill_receive((b).id, (b).place_id, 1, repeat('e', 64), null, now() + interval '16 minutes')->>'code' from s where k = 'late'), 'expired', 'an expired bill is not received');

-- A guest for the suspension checks below.
insert into auth.users (id) values ('00000000-0000-4000-8000-0000900d4889');
insert into public.consumers (id) values ('00000000-0000-4000-8000-0000900d4889') on conflict do nothing;

-- ── Five closed tickets at one restaurant suspend the guest (MESITA-4899) ──
select is((select count(*)::int from generate_series(1, 4) g where public.guest_ticket_closed('00000000-0000-4000-8000-0000900d4889', '00000000-0000-4000-8000-000000014889')), 0, 'four do not');
select is(public.guest_ticket_closed('00000000-0000-4000-8000-0000900d4889', '00000000-0000-4000-8000-000000024889'), false, 'nor one at another place');
select is(public.guest_ticket_closed('00000000-0000-4000-8000-0000900d4889', '00000000-0000-4000-8000-000000014889'), true, 'the fifth at one place does');
select is((select closures from public.guest_suspensions where consumer_id = '00000000-0000-4000-8000-0000900d4889' and reinstated_at is null), 5, 'and it is on record');
update public.guest_suspensions set reinstated_at = now() + interval '1 second' where consumer_id = '00000000-0000-4000-8000-0000900d4889';
select is(public.guest_ticket_closed('00000000-0000-4000-8000-0000900d4889', '00000000-0000-4000-8000-000000014889', now() + interval '2 seconds'), false, 'reinstated, the count starts over');
select ok(not has_table_privilege('authenticated', 'public.guest_suspensions', 'select') and not has_function_privilege('anon', 'public.guest_ticket_closed(uuid, uuid, timestamptz)', 'execute'), 'clients never touch it');

select * from finish();
rollback;
