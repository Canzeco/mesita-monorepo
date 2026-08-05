-- MESITA-898 — per-place "Require bill amount" switch for the check page.
--
-- Since v3b (MESITA-850) the bill is optional everywhere: staff can close a
-- ticket without entering it and apply the discount at their own POS. Some
-- places want the opposite discipline — the bill on record before the close.
-- This flag opts a place in: when true, check-web-mark-paid refuses to close
-- an unbilled ticket (409 bill_required) until check-web-submit-bill ran.
-- Default false keeps the shipped optional-bill behavior for everyone else.
--
-- Lives next to check_pin on projects (same EF-only surface: the column is
-- deliberately NOT in projects_view; owners read it via
-- business-web-get-overview, the public check payload only ever carries the
-- boolean bill_required).

alter table public.projects
  add column check_require_bill boolean not null default false;

comment on column public.projects.check_require_bill is
  'When true, the check page must have a bill on record before staff can close (mark paid) a ticket (MESITA-898). Default false = bill stays optional (v3b, MESITA-850).';
