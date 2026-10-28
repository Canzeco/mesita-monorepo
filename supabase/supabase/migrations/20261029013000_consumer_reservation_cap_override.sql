-- MESITA-2555: a per-guest reservation cap an operator can set.
--
-- The monthly reservation cap is keyed by plan now (_shared/reservation-cap.ts:
-- Free 10, Pro 30 a month). An operator can lift or lower one guest's cap from
-- Manage › Guests (admin-web-set-guest-standing, through
-- admin_set_guest_reservation_cap below); null means "the plan's cap".
-- 0 blocks reservations for that guest. Never written by a consumer function.

alter table public.consumers
  add column if not exists reservation_cap_override integer;

alter table public.consumers drop constraint if exists consumers_reservation_cap_override_check;
alter table public.consumers
  add constraint consumers_reservation_cap_override_check
  check (reservation_cap_override is null or reservation_cap_override between 0 and 1000);

comment on column public.consumers.reservation_cap_override is
  'MESITA-2555: operator-set monthly reservation cap for this guest (0..1000). Null = the plan''s cap (_shared/reservation-cap.ts). Written only by admin_set_guest_reservation_cap.';

-- The one writer. Admin-only, like admin_set_guest_standing: a closed account
-- is skipped (no row comes back).
create or replace function public.admin_set_guest_reservation_cap(
  p_consumer uuid,
  p_cap integer
) returns setof public.consumers
language sql
volatile
security definer
set search_path = public
as $$
  update public.consumers c
     set reservation_cap_override = p_cap
   where c.id = p_consumer
     and c.deleted_at is null
  returning c.*
$$;

revoke execute on function public.admin_set_guest_reservation_cap(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.admin_set_guest_reservation_cap(uuid, integer)
  to service_role;
