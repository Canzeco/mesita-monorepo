-- v3c (MESITA-851): the consumer report button.
--
-- With staff no longer adjudicating tasks (v3a) and the bill optional (v3b),
-- the guest has FEWER in-flow checkpoints where a problem surfaces. A refused
-- discount or a ticket closed without honoring anything currently has exactly
-- one route: arguing with the person holding the terminal. This table is the
-- alternative — and it is what makes the strikes ladder enforceable from the
-- guest's side instead of only from telemetry.
--
-- NOT operator config: transactional evidence, so it is deliberately absent
-- from admin_reset's keep_tables and gets wiped with tickets on a reset.

create table if not exists public.ticket_reports (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  consumer_id uuid not null references public.consumers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  -- The taxonomy the consumer picks from. Free text rides in `details`.
  reason text not null check (reason in (
    'discount_refused',
    'closed_without_honoring',
    'qr_not_scanned',
    'other'
  )),
  details text check (details is null or length(details) <= 1000),
  -- Operator triage. A report is EVIDENCE, never an automatic strike:
  -- recording one must not be able to pause a paid place's promos, because
  -- the guest holds their own QR and could self-serve the accusation.
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

comment on table public.ticket_reports is
  'v3c (MESITA-851): guest-filed reports against a reward ticket. Evidence for operator review — never an automatic strike. Wiped on admin reset with the tickets they reference.';

-- One OPEN report per ticket: a guest reports a visit, not repeatedly.
-- Resolved rows are kept, so a place with a history stays legible.
create unique index if not exists ticket_reports_one_open_per_ticket
  on public.ticket_reports (ticket_id)
  where status = 'open';

-- The operator feed reads by place, newest first (admin-web-list-notifications).
create index if not exists ticket_reports_project_created_idx
  on public.ticket_reports (project_id, created_at desc);

-- Clients never read this table: the consumer writes through an EF and the
-- operator reads through admin-web-list-notifications.
alter table public.ticket_reports enable row level security;
