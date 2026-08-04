-- v3c (MESITA-851): the consumer report button.
--
-- Step 7 of the reward-ticket lifecycle. With staff no longer adjudicating
-- tasks (v3a) and the bill optional (v3b), the guest has fewer in-flow
-- checkpoints where a problem surfaces — a refused discount or a ticket closed
-- without honoring had exactly one route, arguing with whoever holds the
-- terminal. This table is the alternative to that argument.
--
-- A report is EVIDENCE, never an automatic strike. `membership_strike_events`
-- stays the operator's instrument; nothing here touches strike_count. See the
-- decision note on MESITA-851: strike 3 clears a paid plan, which is
-- revenue-affecting and hard to reverse, so it must not hang off a single
-- unverified guest claim — the same reasoning that made v3a stop pretending a
-- staff verdict verified anything.

create table if not exists public.ticket_reports (
  id uuid primary key default gen_random_uuid(),

  -- One report per ticket (see the unique index below). Re-filing edits the
  -- open one rather than stacking duplicates.
  ticket_id uuid not null references public.tickets(id) on delete cascade,

  -- Denormalised from the ticket so the operator inbox and any per-place
  -- rollup can filter without a join, and so a report survives its ticket
  -- being reshaped. consumer_id is the reporter.
  consumer_id uuid not null references public.consumers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  -- The taxonomy from the issue. Kept as a CHECK rather than an enum: these
  -- are product copy and will change faster than a pg enum wants to.
  reason text not null check (
    reason in (
      'discount_refused',        -- staff would not apply the discount
      'closed_without_honoring', -- ticket marked done, nothing honored
      'qr_not_scanned',          -- staff refused/ignored the QR
      'other'
    )
  ),
  detail text check (detail is null or length(detail) <= 1000),

  status text not null default 'open' check (
    status in ('open', 'reviewed', 'dismissed')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text
);

-- One per ticket: a guest with two complaints about one visit has one story to
-- tell, and the operator inbox should not show the same visit twice.
create unique index if not exists ticket_reports_one_per_ticket
  on public.ticket_reports (ticket_id);

-- Operator inbox: newest open reports first.
create index if not exists ticket_reports_status_created_idx
  on public.ticket_reports (status, created_at desc);

-- Per-place history (admin place Performance, and any future strike review).
create index if not exists ticket_reports_project_created_idx
  on public.ticket_reports (project_id, created_at desc);

-- EF-only lockdown, same posture as the rest of the ticket tables: RLS on with
-- NO policies, so only the service role reaches it. Adding a policy here would
-- OPEN access — a report names a place and a complaint, and neither the place
-- nor another consumer may read it.
alter table public.ticket_reports enable row level security;

comment on table public.ticket_reports is
  'v3c (MESITA-851) — consumer reports against a reward ticket. Evidence for an operator, never an automatic membership strike. EF-only (RLS on, no policies).';

create or replace function public.set_ticket_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ticket_reports_set_updated_at on public.ticket_reports;
create trigger ticket_reports_set_updated_at
  before update on public.ticket_reports
  for each row
  execute function public.set_ticket_reports_updated_at();
