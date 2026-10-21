-- MESITA-2560: Plan is Free or Premium, not Pro (Pato, 2026-10-21: "pro sounds
-- more b2b saas"). Reverses the pro half of MESITA-2553 (20261021030000): the
-- stored word matches the word on screen. Class (regular | vip) is untouched.

alter table public.consumers drop constraint if exists consumers_plan_check;
update public.consumers set plan = 'premium' where plan = 'pro';
alter table public.consumers
  add constraint consumers_plan_check check (plan in ('free', 'premium'));

comment on column public.consumers.plan is
  'MESITA-2560: the subscription, free or premium. Independent of guest_class. Operator-set (admin_set_guest_standing) until a checkout exists; then derived from the subscription with an end date.';
comment on column public.consumers.guest_class is
  'MESITA-2553: partnership status, regular or vip. VIP comes through a partner, is never sold and never an upgrade to Premium. Independent of plan. Written only by admin_set_guest_standing.';
