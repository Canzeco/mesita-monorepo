-- Buzz v4 — widen the coupon promo-rate grid to tens (10…50), keeping 70 legal.
--
-- The business Promos page moved from four independent rate pickers to four
-- preset strategies (Zero / Conservative / Aggressive / Dominant). The presets
-- use a tens grid — 10, 20, 30, 40, 50 — where 30 and 40 were previously
-- illegal and 50 is the new ceiling (70 retired on margin math).
--
-- `places` itself carries no rate CHECK (it was dropped in the venues→places
-- rename), so the only DB gate left is on `coupons`: the
-- saved_places_issue_coupon trigger snapshots a place's four rates into each
-- issued coupon, and those columns still constrain to the old {10,20,50,70}.
-- A place on Aggressive/Dominant (rate 30/40) would fail coupon issuance
-- without this widening.
--
-- Additive + backward-compatible: the new set is the UNION of old and new
-- (still including the retired 70) so any coupon or place already carrying 70
-- stays valid. New writes only ever use {10,20,30,40,50} — enforced by the
-- business-web-update-project Edge Function.

alter table public.coupons
  drop constraint if exists coupons_welcome_free_rate_check,
  drop constraint if exists coupons_welcome_premium_rate_check,
  drop constraint if exists coupons_free_rate_check,
  drop constraint if exists coupons_premium_rate_check;

alter table public.coupons
  add constraint coupons_welcome_free_rate_check
    check (welcome_free_rate is null or welcome_free_rate in (10, 20, 30, 40, 50, 70)),
  add constraint coupons_welcome_premium_rate_check
    check (welcome_premium_rate is null or welcome_premium_rate in (10, 20, 30, 40, 50, 70)),
  add constraint coupons_free_rate_check
    check (free_rate is null or free_rate in (10, 20, 30, 40, 50, 70)),
  add constraint coupons_premium_rate_check
    check (premium_rate is null or premium_rate in (10, 20, 30, 40, 50, 70));

notify pgrst, 'reload schema';
