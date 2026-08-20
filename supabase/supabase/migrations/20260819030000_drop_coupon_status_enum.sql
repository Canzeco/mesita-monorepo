-- The coupon feature's last fossil.
--
-- 20260818090000_drop_coupons_and_dead_columns dropped the `coupons` table and
-- `reservations.coupon_id`, but Postgres does not drop a type along with the
-- columns that used it — so `public.coupon_status` outlived the feature. Zero
-- columns reference it (verified against pg_attribute on the live DB), and
-- every regenerated `database.types.ts` kept publishing it to three web apps
-- as a taxonomy the product no longer has.
--
-- A reward comes from showing up, never from saving or booking; nothing brings
-- this type back.

drop type if exists public.coupon_status;
