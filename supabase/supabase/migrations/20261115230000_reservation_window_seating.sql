-- MESITA-3957 RESERVE ASKS A TIME WINDOW AND SEATING (Pato, 2026-11-14: "the
-- agent must have decision-making autonomy but not thaaaaaat much ... small
-- details such as outside or inside table").
--
--   time_window_minutes  how far from reserved_at a1 may take a time without
--                        asking the guest: 0 exact · 30 · 60 either side.
--                        decision: default 30 (the issue's proposal).
--   seating              any · inside · outside · bar
--   reported_time        the time a1 got inside the window (mid-call report);
--                        the confirmed outcome moves reserved_at to it
--   confirmed_terms      a table time limit or tolerance rule a1 accepted;
--                        the app shows it to the guest

alter table public.reservation_tickets
  add column if not exists time_window_minutes smallint not null default 30,
  add column if not exists seating text not null default 'any',
  add column if not exists reported_time timestamptz,
  add column if not exists confirmed_terms text;

alter table public.reservation_tickets
  drop constraint if exists reservation_tickets_time_window_check,
  add constraint reservation_tickets_time_window_check
    check (time_window_minutes in (0, 30, 60)),
  drop constraint if exists reservation_tickets_seating_check,
  add constraint reservation_tickets_seating_check
    check (seating in ('any', 'inside', 'outside', 'bar')),
  drop constraint if exists reservation_tickets_confirmed_terms_len,
  add constraint reservation_tickets_confirmed_terms_len
    check (confirmed_terms is null or char_length(confirmed_terms) <= 300);
