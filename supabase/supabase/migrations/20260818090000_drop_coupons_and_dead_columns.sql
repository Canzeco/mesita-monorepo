-- Coupons die. The visit ticket already snapshots its own rates
-- (snapshotRatesFromPlace writes free_rate / premium_rate / welcome_* /
-- rates_snapshotted_at at creation), and the rate was never personal to a
-- coupon: it is place x class, computed live by consumer-web-get-reward-quote.
-- The coupon was a cached copy of something that was never a grant.
--
-- Product consequence, decided deliberately: a reward comes from SHOWING UP.
-- Not from saving a place, not from holding a booking. The reservation ticket
-- therefore loses its discount surface, which is correct — nothing should be
-- discounted for a table that might no-show.
--
-- The strike loses its guest-side compensation with them. Compensating
-- against a future visit ticket is additive and can land later; a dangling FK
-- to a dropped table cannot.

drop trigger if exists saved_places_issue_coupon  on public.saved_places;
drop trigger if exists saved_places_cancel_coupon on public.saved_places;
drop function if exists public.tg_saved_places_issue_coupon();
drop function if exists public.tg_saved_places_cancel_coupon();

alter table public.reservations       drop column if exists coupon_id;
alter table public.membership_strikes drop column if exists compensation_coupon_id;

drop table if exists public.coupons;

-- Superseded by app_settings.rewards_config v11, which has priced every
-- ticket since the v11 migration landed.
drop table if exists public.reward_rules;

-- One skeleton + a type discriminator was rejected: the three tickets are
-- genuinely different objects with different lifecycles, so there is no
-- discriminator to keep.
alter table public.tickets drop column if exists kind;
drop type if exists public.ticket_kind;

-- Reservations were modelled twice — as columns here and as their own table.
-- The table wins; it is the one the Reservationist actually drives.
alter table public.tickets
  drop column if exists reservation_status,
  drop column if exists reservation_at,
  drop column if exists reservation_party_size,
  drop column if exists reservation_channel,
  drop column if exists reservation_notes;

-- Tickets v2 made the CONSUMER the creator and has no waiter identity;
-- business-web-create-ticket is deleted. opened_by is the surviving column.
alter table public.tickets drop column if exists opened_by_staff_user_id;
