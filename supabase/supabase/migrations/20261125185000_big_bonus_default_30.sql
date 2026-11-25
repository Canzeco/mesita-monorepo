-- MESITA-4980 — the three Prepay columns are 10, 20, and 30.
-- Pato, 2026-11-25: the $5,000 bonus shows +40% and must be +30%.
-- Big's low pick moves from 4000 to 3000. The high pick stays 6000.
-- A voucher already bought keeps the bonus stored on that purchase.

alter table public.place_cashback_settings drop constraint if exists place_cashback_settings_big_bonus_check;
alter table public.cashback_defaults drop constraint if exists cashback_defaults_big_bonus_check;

alter table public.place_cashback_settings alter column big_bonus_bps set default 3000;
alter table public.cashback_defaults alter column big_bonus_bps set default 3000;

update public.place_cashback_settings set big_bonus_bps = 3000 where big_bonus_bps = 4000;
update public.cashback_defaults set big_bonus_bps = 3000 where big_bonus_bps = 4000;

alter table public.place_cashback_settings
  add constraint place_cashback_settings_big_bonus_check check (big_bonus_bps in (3000, 6000));
alter table public.cashback_defaults
  add constraint cashback_defaults_big_bonus_check check (big_bonus_bps in (3000, 6000));

comment on column public.place_cashback_settings.big_bonus_bps is
  'MESITA-4764, MESITA-4980: the Big voucher''s (voucher_5000) bonus at this place, basis points of the price: 3000 or 6000. The default is 3000. Stored on each purchase at buy time.';
comment on column public.cashback_defaults.big_bonus_bps is
  'MESITA-4764, MESITA-4980: the Big voucher bonus every place without its own row reads: 3000 or 6000. The default is 3000.';
