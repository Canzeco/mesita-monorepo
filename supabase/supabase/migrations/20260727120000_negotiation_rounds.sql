-- Negotiation loop counter for the Reservationist. Incremented each time the
-- guest picks a venue alternative OR proposes a different datetime on the
-- Confirmer call (eleven-a2-confirm-reservation) — each increment re-fires the
-- Booker against the venue. The EF caps it at 2 rounds; past the cap the
-- ticket parks in-app instead of calling again.
alter table public.reservations
  add column if not exists negotiation_rounds int not null default 0;
