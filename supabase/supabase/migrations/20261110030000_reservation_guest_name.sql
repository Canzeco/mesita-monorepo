-- MESITA-3607 — the name a table is booked under is the guest's choice per
-- reservation (Pato, 2026-11-10: "First Name and Last Name (don't prepopulate
-- first name)"). The Reserve sheet sends both; the call engine and the agent
-- tools say this name, and older tickets (null) keep the consumer's profile
-- name (_shared/reservation-guest-name.ts ticketGuestName).

alter table public.reservation_tickets
  add column guest_first_name text,
  add column guest_last_name text;

alter table public.reservation_tickets
  add constraint reservation_tickets_guest_name_len
    check (char_length(coalesce(guest_first_name, '')) <= 60 and char_length(coalesce(guest_last_name, '')) <= 60);

comment on column public.reservation_tickets.guest_first_name is
  'MESITA-3607: first name the table is booked under, typed on the Reserve sheet; null on older tickets (use the consumer''s name).';
comment on column public.reservation_tickets.guest_last_name is
  'MESITA-3607: last name the table is booked under, typed on the Reserve sheet; null on older tickets (use the consumer''s name).';
