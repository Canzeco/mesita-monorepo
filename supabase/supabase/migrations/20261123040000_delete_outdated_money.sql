-- MESITA-4705 — DELETE THE MONEY DATA THAT NO LONGER FITS. Pato, 2026-11-22:
-- "delete the out registries of visits paid with cards and so on … if you
-- see data that doesn't fit the new scheme version now, just delete it, don't
-- try to persist outdated data, else we are going to have a frankenstein db."
-- Confirmed with the counts: "Yes, delete them".
--
-- The model since MESITA-4698: a bill is paid with credit and the rest
-- outside (no card); vouchers are Small · Medium · Big; cashback is the kind
-- 'cashback'. Deleted, TEST MODE ONLY (the block refuses if any live row is
-- in the set):
--   1. bills (pay_tabs) with any card part, with their whole split table
--      (the parent and every share), and every payment, entry, attempt,
--      charge, fee line and refund attempt tied to them;
--   2. card payments (wallet_payments.card_cents > 0) and the same ties;
--   3. guest pay attempts by card;
--   4. purchases of retired vouchers (Welcome, VIP, Story) with their whole
--      basket, their entries, stories, mentions, fee lines and refunds;
--   5. the legacy 'extra' entries of the cashback retired by MESITA-4194.
-- Balances are sums of entries, so they follow by themselves.

do $$
declare
  v_live integer;
begin
  -- The sets, in temp tables so every step reads the same rows.
  create temp table x_tabs on commit drop as
    select id from public.pay_tabs where card_bill_cents > 0 or card_tip_cents > 0;
  -- The whole split table: a card share takes its parent and its siblings.
  insert into x_tabs
    select t.parent_tab_id from public.pay_tabs t
     where t.id in (select id from x_tabs) and t.parent_tab_id is not null
    on conflict do nothing;
  insert into x_tabs
    select t.id from public.pay_tabs t where t.parent_tab_id in (select id from x_tabs);
  create temp table x_tab_ids on commit drop as select distinct id from x_tabs;

  create temp table x_payments on commit drop as
    select id from public.wallet_payments
     where card_cents > 0 or tab_id in (select id from x_tab_ids);

  create temp table x_purchases on commit drop as
    select id from public.wallet_purchases where voucher in ('voucher_welcome', 'voucher_vip', 'voucher_story');
  -- A basket goes whole: its lead and every follower.
  insert into x_purchases
    select p.id from public.wallet_purchases p
     where p.basket_lead_id in (select id from x_purchases)
        or p.id in (select basket_lead_id from public.wallet_purchases where id in (select id from x_purchases) and basket_lead_id is not null);
  insert into x_purchases
    select p.id from public.wallet_purchases p where p.basket_lead_id in (select id from x_purchases);
  create temp table x_purchase_ids on commit drop as select distinct id from x_purchases;

  -- Test mode only.
  select (select count(*) from public.pay_tabs where id in (select id from x_tab_ids) and livemode)
       + (select count(*) from public.wallet_payments where id in (select id from x_payments) and livemode)
       + (select count(*) from public.wallet_purchases where id in (select id from x_purchase_ids) and livemode)
       + (select count(*) from public.wallet_entries where kind = 'extra' and livemode)
    into v_live;
  if v_live > 0 then
    raise exception 'MESITA-4705: % live rows in the delete set; refusing', v_live;
  end if;

  -- Entries first (they point at payments, purchases and bills).
  delete from public.wallet_entries
   where payment_id in (select id from x_payments)
      or tab_id in (select id from x_tab_ids)
      or purchase_id in (select id from x_purchase_ids)
      or kind = 'extra';

  delete from public.wallet_refund_attempts
   where payment_id in (select id from x_payments) or purchase_id in (select id from x_purchase_ids);
  delete from public.place_fee_lines
   where payment_id in (select id from x_payments) or purchase_id in (select id from x_purchase_ids);
  delete from public.place_charges where payment_id in (select id from x_payments);
  delete from public.story_mentions where purchase_id in (select id from x_purchase_ids);

  delete from public.guest_pay_attempts
   where tender = 'card'
      or payment_id in (select id from x_payments)
      or tab_id in (select id from x_tab_ids);

  delete from public.wallet_payments where id in (select id from x_payments);

  -- Shares before their table (parent_tab_id is restrict).
  delete from public.pay_tabs where id in (select id from x_tab_ids) and parent_tab_id is not null;
  delete from public.pay_tabs where id in (select id from x_tab_ids);

  -- Followers before their lead (basket_lead_id); stories cascade.
  delete from public.wallet_purchases where id in (select id from x_purchase_ids) and basket_lead_id is not null;
  delete from public.wallet_purchases where id in (select id from x_purchase_ids);
end $$;
