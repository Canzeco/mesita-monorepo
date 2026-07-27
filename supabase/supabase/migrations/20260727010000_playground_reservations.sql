-- Playground reservations — the Reservations Playground's SANDBOX ledger.
--
-- The admin Playground emulates a full reservation intent (real place + real
-- consumer from the Mesita DB + operator-authored intent) and places a REAL
-- Reservationist call. The resulting tickets are deliberately NOT rows in
-- public.reservations: playground tickets must never surface in any consumer
-- app, count against a consumer's monthly cap, or leak into business consoles.
-- They live here instead — remembered across sessions, visible only through
-- the admin-web-*-playground-reservation* EFs.
--
-- No FKs to places/consumers on purpose: tickets are a test LOG. They snapshot
-- the names they were created with and must survive their source rows being
-- reset/deleted (admin_reset_database, test consumers, re-sourced places).
--
-- RLS enabled with NO policies = the deliberate EF-only lockdown (service-role
-- EFs bypass RLS; anon/authenticated see nothing). Adding policies OPENS access.

create table if not exists public.playground_reservations (
  id                   uuid        primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  created_by           uuid,
  project_id           uuid        not null,
  place_name           text        not null,
  consumer_id          uuid        not null,
  consumer_name        text        not null,
  reserved_at          timestamptz not null,
  party_size           integer     not null,
  notes                text,
  status               text        not null default 'pending',
  business_number_mode text        not null,
  business_number      text,
  consumer_number_mode text        not null,
  consumer_number      text,
  call_status          text,
  conversation_id      text,
  called_at            timestamptz
);

alter table public.playground_reservations enable row level security;

create index if not exists playground_reservations_created_at_idx
  on public.playground_reservations (created_at desc);

comment on table public.playground_reservations is
  'Reservations Playground sandbox tickets (admin console). Emulated intents that placed (or tried to place) a real Reservationist call. Never joined to public.reservations; EF-only access.';
comment on column public.playground_reservations.business_number_mode is
  'Which venue-side line the call dialed: test (config business test number) | actual (the place''s real reservation endpoint).';
comment on column public.playground_reservations.consumer_number_mode is
  'Which guest-side callback number the brief carried: test (config consumer test number) | actual (the consumer''s real phone).';
comment on column public.playground_reservations.call_status is
  'Outcome of the outbound attempt: placed | failed: … | no ELEVENLABS_KEY (diagnostic).';
comment on column public.playground_reservations.conversation_id is
  'ElevenLabs Convai conversation_id of the placed call, when the call went out.';
