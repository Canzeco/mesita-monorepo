-- MESITA-3870 — the guest Plan is sold again. Pato, 2026-11-14: "2
-- Reservations per month is Free. 10 Reservations per month if Pro. ... make
-- it 2 dollar per month."
--
-- Pro is a $2/month Stripe subscription on Mesita's own account (STRIPE_MODE).
-- No webhook: consumer-web-get-plan reads the subscription back from Stripe
-- (on Checkout's return and on every open of Me › Plan), and
-- consumer-web-create-reservation re-reads it when the paid period has run
-- out. These columns are that read's last answer. consumers.plan stays the
-- plan ('free' | 'premium', labelled Pro); a 'premium' row with no
-- subscription is an operator's grant (Manage › Guests) and never lapses.

alter table public.consumers
  add column if not exists plan_stripe_subscription text,
  add column if not exists plan_livemode boolean,
  add column if not exists plan_paid_until timestamptz,
  add column if not exists plan_cancel_at_period_end boolean not null default false;

comment on column public.consumers.plan_stripe_subscription is
  'MESITA-3870: the Stripe subscription that pays for Pro ($2/month), or null. Service role writes only.';
comment on column public.consumers.plan_livemode is
  'MESITA-3870: the Stripe universe plan_stripe_subscription lives in; a subscription of the other universe grants nothing.';
comment on column public.consumers.plan_paid_until is
  'MESITA-3870: the end of the paid Pro period, as Stripe last reported it.';
comment on column public.consumers.plan_cancel_at_period_end is
  'MESITA-3870: the guest cancelled; Pro runs to plan_paid_until and does not renew.';

-- The one writer of the Stripe read (_shared/guest-plan.ts syncPlan). Plan is
-- outside the consumer door (consumer-doc.ts): admin_set_guest_standing
-- writes an operator's choice, this writes what Stripe says. Service role only.
create or replace function public.consumer_plan_sync(
  p_consumer uuid,
  p_plan text,
  p_subscription text,
  p_livemode boolean,
  p_paid_until timestamptz,
  p_cancel_at_period_end boolean
) returns table (
  plan text,
  reservation_cap_override integer,
  plan_stripe_subscription text,
  plan_livemode boolean,
  plan_paid_until timestamptz,
  plan_cancel_at_period_end boolean
)
language sql
volatile
security definer
set search_path = public
as $$
  update public.consumers c
     set plan = p_plan,
         plan_stripe_subscription = p_subscription,
         plan_livemode = p_livemode,
         plan_paid_until = p_paid_until,
         plan_cancel_at_period_end = coalesce(p_cancel_at_period_end, false)
   where c.id = p_consumer
     and c.deleted_at is null
  returning c.plan, c.reservation_cap_override, c.plan_stripe_subscription,
            c.plan_livemode, c.plan_paid_until, c.plan_cancel_at_period_end
$$;

revoke execute on function public.consumer_plan_sync(uuid, text, text, boolean, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.consumer_plan_sync(uuid, text, text, boolean, timestamptz, boolean)
  to service_role;
