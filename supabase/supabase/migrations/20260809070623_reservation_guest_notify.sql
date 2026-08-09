-- MESITA-787: per-reservation guest notification preference.
-- call = a2 may ring the guest (confirm / counter-offer / cancel notice).
-- app  = in-app ticket updates only; engine skips guest outbound calls.

alter table public.reservations
  add column if not exists guest_notify text not null default 'call'
    constraint reservations_guest_notify_check
      check (guest_notify in ('call', 'app'));

comment on column public.reservations.guest_notify is
  'call = a2 may ring guest (confirm/counter/cancel notice); app = in-app only (MESITA-787).';
