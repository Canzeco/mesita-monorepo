-- MESITA-4187 THE GUEST CHOOSES HOW A CONFIRMED TABLE REACHES THEM (Pato,
-- 2026-11-16: "On Confirmation (app + call me) · On Rejection (app + call
-- me)").
--
--   confirm_notify  app  · the app tells them (the MESITA-3961 default)
--                   call · the app, and a2 phones to say the table is booked
--
-- consumer_notify keeps its meaning: how a place's other times or a
-- refusal reach the guest (On rejection).

alter table public.reservation_tickets
  add column if not exists confirm_notify text not null default 'app';

alter table public.reservation_tickets
  drop constraint if exists reservation_tickets_confirm_notify_check,
  add constraint reservation_tickets_confirm_notify_check
    check (confirm_notify in ('app', 'call'));
