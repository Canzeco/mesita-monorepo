-- MESITA-4645 — THE WELCOME VOUCHER IS BACK. Pato, 2026-11-22: "RETURN THE
-- WELCOME BONUS. WELCOME AND THEN THE OTHER BONUSES." It left on 2026-11-21
-- (MESITA-4636, 20261122150000_no_welcome_voucher): its key is back in the
-- catalog and the buy door (_shared/money-state.ts, vouchers.ts), MX$100
-- +100%, once per guest per place.
--
-- place_payment_settings.voucher_welcome is a live switch again: the check
-- that held it false goes. Every place still reads false (MESITA-4636 turned
-- them off and this turns none back on); each owner switches it on in
-- Business › Payments. The default stays false.

alter table public.place_payment_settings
  drop constraint if exists place_payment_settings_no_welcome;

comment on column public.place_payment_settings.voucher_welcome is
  'The Welcome voucher (MX$100 +100%, once per guest per place) on sale here. Off by default; back since MESITA-4645 after MESITA-4636 removed it.';

-- Welcome is once per guest per place, enforced where two buys can race
-- (20261107050000_w1a_ledger_on_connect; dropped by MESITA-4636).
create unique index if not exists wallet_purchases_welcome_once_idx
  on public.wallet_purchases (consumer_id, place_id)
  where voucher = 'voucher_welcome' and status not in ('expired', 'failed');
