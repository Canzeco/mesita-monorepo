-- THE TICKET v4 schema (MESITA-1086) — file B of two: everything that names
-- the labels file A added. Additive and unread: no deployed EF selects or
-- writes any column below until the v4 EFs ship (MESITA-1088+), so every
-- existing caller's behaviour is byte-identical after this applies.
--
-- Verified against the live singleton before writing: 1 ticket, at 'open',
-- `tip_cents` all 0/NULL — nothing to backfill.

-- 1 ── The v4 columns.
--
-- tip_cents ALREADY EXISTS (0002_tickets.sql) and stays the single source of
-- tip truth. tip_pct records only WHICH preset the guest picked (NULL = a
-- custom peso amount), so a bill re-entry can recompute the tip on the new
-- subtotal instead of silently zeroing it — the C4 money-loss guard.
alter table public.tickets
  add column tip_pct smallint
    constraint tickets_tip_pct_range
    check (tip_pct is null or tip_pct between 0 and 100),
  add column approved_at timestamptz,
  add column approved_discount_cents integer
    constraint tickets_approved_discount_nonneg
    check (approved_discount_cents is null or approved_discount_cents >= 0),
  add column approved_amount_due_cents integer
    constraint tickets_approved_due_nonneg
    check (approved_amount_due_cents is null or approved_amount_due_cents >= 0),
  add column fix_requested text
    constraint tickets_fix_requested_kind
    check (fix_requested is null or fix_requested in ('bill', 'proof', 'reward')),
  add column fix_note text
    constraint tickets_fix_note_len
    check (fix_note is null or char_length(fix_note) <= 200),
  add column paid_method text
    constraint tickets_paid_method_kind
    check (paid_method is null or paid_method in ('at_place', 'mesita')),
  add column validated_at timestamptz;

comment on column public.tickets.tip_pct is
  'Preset tip percent the guest picked (10/15/20); NULL = custom peso amount. tip_cents stays the single tip truth — this only lets a bill re-entry recompute it.';
comment on column public.tickets.approved_at is
  'Staff approved the ticket (validate-web-approve-ticket). Approval freezes the amount: reprice early-returns once set.';
comment on column public.tickets.approved_discount_cents is
  'Snapshot of discount_cents at approval — "the last moment anything can change the amount", made enforceable.';
comment on column public.tickets.approved_amount_due_cents is
  'Snapshot of the amount due at approval, same freeze.';
comment on column public.tickets.fix_requested is
  'Staff sent the ticket back for ONE specific fix (bill|proof|reward). A COLUMN, never a status: the ticket stays at scanned, same check_code, no new QR.';
comment on column public.tickets.paid_method is
  'How the guest settles after approval: at_place (live) | mesita (staged — the EF 501s).';
comment on column public.tickets.validated_at is
  'Payment confirmed and the ticket closed (validate-web-validate-ticket). revealed stays the terminal status; this is the v4 timestamp.';

-- 2 ── Approve and send-back are mutually exclusive BY CONSTRUCTION. Two
--     devices holding the same QR are equally authorized by design, so a
--     race between Approve and Pedir-corrección must be unpersistable, not
--     merely unlikely.
alter table public.tickets
  add constraint tickets_approved_xor_fix
  check (not (approved_at is not null and fix_requested is not null));

-- 3 ── The status default stops being the dead 'pending_payment'. Every
--     shipped insert names its status explicitly; this closes the trap where
--     a defaulted insert lands in a state no filter matches, invisible
--     forever.
alter table public.tickets alter column status set default 'open';

-- 4 ── QR-farming guard rebuilt over the LIVE set. The old predicate covered
--     only status='open', so a ticket that left 'open' (staff-billed today;
--     scanned/approved/paying under v4) stopped counting and the guest could
--     mint a second live QR at the same place — one guest, two tickets, base
--     + welcome claimable twice. Same index NAME on purpose:
--     consumer-web-create-ticket's 23505 handler matches it, and its
--     pre-check reads the equal CHECK_DEDUPE_STATUSES set from
--     _shared/ticket-status.ts (widened in this PR, drift-tested).
drop index public.tickets_one_open_check_per_consumer_place;
create unique index tickets_one_open_check_per_consumer_place
  on public.tickets (consumer_id, project_id)
  where status in ('open', 'scanned', 'approved', 'paying', 'awaiting_payment_confirm')
    and check_code is not null;

-- 5 ── ticket_check_events widens for the v4 handshake — and finally admits
--     pin_rejected, which _shared/ticket-check.ts has written since check_pin
--     shipped while this CHECK silently dropped it (logCheckEvent discards
--     its insert error), so the PIN throttle never actually counted misses.
alter table public.ticket_check_events
  drop constraint ticket_check_events_event_check;
alter table public.ticket_check_events
  add constraint ticket_check_events_event_check
  check (event in (
    'scanned', 'bill_submitted',
    'story_approved', 'story_rejected', 'review_approved', 'review_rejected',
    'marked_paid',
    'scan_opened', 'approved', 'fix_requested', 'validated',
    'pin_rejected'
  ));
