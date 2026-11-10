-- MESITA-3619 — a double tap on Reserve makes one reservation.
--
-- The Reserve sheet sends a request_id (one uuid per request; a retry of the
-- same request reuses it). consumer-web-create-reservation stores it, and a
-- second create with the same id for the same guest returns the ticket the
-- first one made instead of booking — and phoning the place — twice. Older
-- clients send none (null), which the index ignores.

alter table public.reservation_tickets
  add column request_id uuid;

create unique index reservation_tickets_consumer_request_key
  on public.reservation_tickets (consumer_id, request_id)
  where request_id is not null;

comment on column public.reservation_tickets.request_id is
  'MESITA-3619: the Reserve request that made this ticket (client uuid); unique per consumer, so a retried create returns this ticket instead of a second one. Null on older tickets.';
