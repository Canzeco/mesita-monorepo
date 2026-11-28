-- MESITA-5067 (Pato, 2026-11-27): Prepay is the business, Cashback is the
-- first step, Discount is gone. Every place and the defaults pay their visit
-- lines as cashback. Bills already recorded as 'discount' keep their record;
-- the save path (_shared/cashback.ts readCashbackInput) refuses 'discount'.

update public.place_cashback_settings
   set visit_mechanism = 'cashback'
 where visit_mechanism <> 'cashback';

update public.cashback_defaults
   set visit_mechanism = 'cashback'
 where visit_mechanism <> 'cashback';
