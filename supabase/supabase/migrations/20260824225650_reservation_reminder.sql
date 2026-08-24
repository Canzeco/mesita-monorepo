-- Leg 7 · reminder call (Docs › Reservations). a2 rings the guest ~3 h
-- before a CONFIRMED slot. Config-gated OFF at reservations_config.reminder
-- — the columns park the errand even while the knob is off so flipping it
-- ON covers already-held tables still inside the window.

alter table public.reservation_tickets
  add column if not exists reminder_state text not null default 'idle',
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_attempts integer not null default 0,
  add column if not exists reminder_conversation_id text;

alter table public.reservation_tickets
  drop constraint if exists reservation_tickets_reminder_state_check;
alter table public.reservation_tickets
  add constraint reservation_tickets_reminder_state_check
  check (reminder_state in (
    'idle', 'scheduled', 'ringing', 'calling', 'answered', 'failed', 'skipped'
  ));

comment on column public.reservation_tickets.reminder_state is
  'Leg 7 reminder errand: idle until confirmed, then scheduled/skipped; cap 1.';
comment on column public.reservation_tickets.reminder_at is
  'When the one reminder call may fire (place-local quiet hours, never waived).';

create index if not exists reservation_tickets_due_reminder_idx
  on public.reservation_tickets (reminder_at)
  where reminder_state = 'scheduled';
