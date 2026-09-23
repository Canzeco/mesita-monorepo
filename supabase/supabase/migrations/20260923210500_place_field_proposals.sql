-- Field correction proposals + the writer half (MESITA-2029).
--
-- The pin GUARD has been live since MESITA-1190; this migration adds the table
-- proposals queue into when confidence is below the source floor, and the
-- business console path that always auto-applies and WRITES the pin (the
-- load-bearing step — a value without a pin reverts on the next enrich run).

create type public.field_proposal_status as enum (
  'pending',
  'applied',
  'rejected'
);

create table if not exists public.place_field_proposals (
  id            uuid primary key default gen_random_uuid(),
  place_id      uuid not null references public.places(id) on delete cascade,
  field         text not null,
  proposed_value jsonb not null,
  source        text not null,
  confidence    numeric(4, 3) not null,
  evidence      text not null default '',
  observed_at   timestamptz not null default now(),
  status        public.field_proposal_status not null default 'pending',
  reviewed_at   timestamptz,
  reviewer_id   uuid,
  created_at    timestamptz not null default now(),
  constraint place_field_proposals_confidence_range
    check (confidence >= 0 and confidence <= 1),
  constraint place_field_proposals_field_correctable
    check (field in (
      'hours',
      'phone',
      'reservation_target',
      'website_url',
      'address',
      'closes_at'
    )),
  constraint place_field_proposals_source_known
    check (source in (
      'reservationist',
      'business',
      'consumer_report',
      'ojo',
      'admin'
    ))
);

create index if not exists place_field_proposals_place_pending_idx
  on public.place_field_proposals (place_id, created_at desc)
  where status = 'pending';

alter table public.place_field_proposals enable row level security;

comment on table public.place_field_proposals is
  'Queued field corrections awaiting admin review, or an audit of applied ones. EF-only; no client policies.';
