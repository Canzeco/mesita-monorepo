-- MESITA-543 — drop legacy promo rate 70; legal set is now {10,20,30,40,50}.
--
-- Follow-up to MESITA-511 / 20260711153426_coupons_promo_rate_tens_grid: 70
-- stayed legal so the pre–Buzz-v4 Promos UI could still write it during
-- rollout. That UI is gone from production; no projects or coupons row
-- currently carries 70.
--
-- Also retightens public.projects.units_promo_rate_legal_values. The tens-grid
-- migration only widened coupons; projects still constrained to the old
-- {10,20,50,70}, which would reject Buzz v4 Aggressive/Dominant (30/40)
-- writes through projects_view. Align both gates to the same set.

alter table public.coupons
  drop constraint if exists coupons_welcome_free_rate_check,
  drop constraint if exists coupons_welcome_premium_rate_check,
  drop constraint if exists coupons_free_rate_check,
  drop constraint if exists coupons_premium_rate_check;

alter table public.coupons
  add constraint coupons_welcome_free_rate_check
    check (welcome_free_rate is null or welcome_free_rate in (10, 20, 30, 40, 50)),
  add constraint coupons_welcome_premium_rate_check
    check (welcome_premium_rate is null or welcome_premium_rate in (10, 20, 30, 40, 50)),
  add constraint coupons_free_rate_check
    check (free_rate is null or free_rate in (10, 20, 30, 40, 50)),
  add constraint coupons_premium_rate_check
    check (premium_rate is null or premium_rate in (10, 20, 30, 40, 50));

alter table public.projects
  drop constraint if exists units_promo_rate_legal_values;

alter table public.projects
  add constraint units_promo_rate_legal_values check (
    (welcome_free_rate    is null or welcome_free_rate    = any (array[10,20,30,40,50])) and
    (welcome_premium_rate is null or welcome_premium_rate = any (array[10,20,30,40,50])) and
    (free_rate            is null or free_rate            = any (array[10,20,30,40,50])) and
    (premium_rate         is null or premium_rate         = any (array[10,20,30,40,50]))
  );

comment on column public.projects.welcome_free_rate    is 'First-visit promo for Free guests. One of 10, 20, 30, 40, 50 or null.';
comment on column public.projects.welcome_premium_rate is 'First-visit promo for Premium guests. One of 10, 20, 30, 40, 50 or null.';
comment on column public.projects.free_rate            is 'Returning-visit promo for Free guests. One of 10, 20, 30, 40, 50 or null.';
comment on column public.projects.premium_rate         is 'Returning-visit promo for Premium guests. One of 10, 20, 30, 40, 50 or null.';

notify pgrst, 'reload schema';
