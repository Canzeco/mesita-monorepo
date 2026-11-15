-- MESITA-4073 A PLACE CAN ASK TO CHANGE A TABLE'S TIME OR PARTY SIZE (Pato,
-- 2026-11-14: a4 "can change the time or party size, not only cancel. The
-- guest is told in the app and accepts the change.").
--
-- The place calls Mesita's line (a3, place lane) about a confirmed table and
-- proposes a new time and/or party size (eleven-a4-change-reservation). The
-- table keeps its time and size until the guest answers in the app
-- (consumer-web-confirm-reservation, change: accept | decline).
--
--   change_state        none · proposed · accepted · declined · expired
--   change_reserved_at  the proposed time (null = the time stays)
--   change_party_size   the proposed size (null = the size stays)
--   change_note         the place's reason, in its words
--   change_proposed_at  when the place asked
--   change_expires_at   the guest's deadline; the cron expires it after
--   change_answered_at  when the guest answered (or it expired)
--
-- decision: a decline or no answer keeps the original table, and a1 tells
-- the place (notice_kind 'change_declined', a plain text column).

alter table public.reservation_tickets
  add column if not exists change_state text not null default 'none',
  add column if not exists change_reserved_at timestamptz,
  add column if not exists change_party_size smallint,
  add column if not exists change_note text,
  add column if not exists change_proposed_at timestamptz,
  add column if not exists change_expires_at timestamptz,
  add column if not exists change_answered_at timestamptz;

alter table public.reservation_tickets
  drop constraint if exists reservation_tickets_change_state_check,
  add constraint reservation_tickets_change_state_check
    check (change_state in ('none', 'proposed', 'accepted', 'declined', 'expired')),
  drop constraint if exists reservation_tickets_change_party_size_check,
  add constraint reservation_tickets_change_party_size_check
    check (change_party_size is null or change_party_size between 1 and 10),
  drop constraint if exists reservation_tickets_change_note_len,
  add constraint reservation_tickets_change_note_len
    check (change_note is null or char_length(change_note) <= 300),
  drop constraint if exists reservation_tickets_change_has_something,
  add constraint reservation_tickets_change_has_something
    check (change_state <> 'proposed' or change_reserved_at is not null or change_party_size is not null);

-- The cron's expiry sweep reads open proposals by deadline.
create index if not exists reservation_tickets_change_open_idx
  on public.reservation_tickets (change_expires_at)
  where change_state = 'proposed';
