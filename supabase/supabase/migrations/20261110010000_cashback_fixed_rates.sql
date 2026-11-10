-- MESITA-3596 — cashback is a switch, not a dial (Pato, 2026-11-09: "in
-- cashback only enable OFF or 2% and OFF or 5%. Reduce optionality.").
-- Mesita Payments Cashback is Off (null) or 5% (500 bps); Cash Payments
-- Cashback is Off (null) or 2% (200 bps). Nothing in between.
--
-- Existing rows: any rate that is on keeps on at the fixed rate (card → 500,
-- cash → 200), so no place loses cashback it had turned on. Live had no
-- place_payment_settings rows when this was written. With 2% ≤ 5% the
-- cash-never-above-card guard can never fire again; it stays as a backstop.
-- Rates already stored on wallet_payments rows are history and untouched.

update public.place_payment_settings
   set card_cashback_bps = case when card_cashback_bps is null then null else 500 end,
       cash_cashback_bps = case when cash_cashback_bps is null then null else 200 end
 where (card_cashback_bps is not null and card_cashback_bps <> 500)
    or (cash_cashback_bps is not null and cash_cashback_bps <> 200);

alter table public.place_payment_settings
  drop constraint if exists place_payment_settings_card_cashback_bps_check,
  drop constraint if exists place_payment_settings_cash_cashback_bps_check,
  add constraint place_payment_settings_card_cashback_bps_check
    check (card_cashback_bps is null or card_cashback_bps = 500),
  add constraint place_payment_settings_cash_cashback_bps_check
    check (cash_cashback_bps is null or cash_cashback_bps = 200);

comment on column public.place_payment_settings.card_cashback_bps is
  'MESITA-3589, fixed by MESITA-3596: Mesita Payments Cashback, null = Off, else exactly 500 bps (5%) on the card part only. Needs House Credits.';
comment on column public.place_payment_settings.cash_cashback_bps is
  'MESITA-3589, fixed by MESITA-3596: Cash Payments Cashback, null = Off, else exactly 200 bps (2%) on the cash bill part only. Needs House Credits.';
