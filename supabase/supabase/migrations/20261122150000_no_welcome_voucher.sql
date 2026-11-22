-- MESITA-4636 — THE WELCOME VOUCHER IS GONE ACROSS MESITA. Pato, 2026-11-21:
-- "Remove the welcome voucher from anywhere. i don't want fucking fradus."
-- Its key left the catalog and the buy door (_shared/money-state.ts,
-- vouchers.ts). place_payment_settings.voucher_welcome stays a dead column,
-- like voucher_vip (MESITA-4249): every place reads false and a check keeps it
-- false, so no owner, EF or script can turn the offer back on. Welcome
-- purchases already made stay in the ledger untouched (the guest's money).

update public.place_payment_settings
   set voucher_welcome = false, updated_at = now()
 where voucher_welcome;

alter table public.place_payment_settings
  alter column voucher_welcome set default false;

alter table public.place_payment_settings
  add constraint place_payment_settings_no_welcome check (voucher_welcome = false);

comment on column public.place_payment_settings.voucher_welcome is
  'Dead since MESITA-4636 (the Welcome voucher is gone, fraud): always false, held by place_payment_settings_no_welcome. Nothing reads it.';

-- Welcome once per guest per place guarded a voucher nobody can buy now.
drop index if exists public.wallet_purchases_welcome_once_idx;
