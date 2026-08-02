-- Tickets v2 — consumer-created self-check-in (MESITA-806).
--
-- The reward-ticket flow inverts: the CONSUMER creates the ticket (place +
-- bonus opt-ins) and gets a QR encoding https://mesita.ai/check/<check_code>.
-- Staff involvement collapses to opening that public page (authenticity) and
-- entering the bill total there. Staff-initiated creation
-- (business-web-create-ticket) retires in the same change.
--
-- 1 — check_code: the possession token. 22-char base64url from 16 random
--     bytes (128 bits), generated in consumer-web-create-ticket. This — not
--     consumers.code (sequential 8 digits, guessable) — is the security
--     boundary of the public check-web-* endpoints. Nullable: legacy rows
--     never get one; presence marks a v2 consumer-created ticket.
alter table public.tickets
  add column check_code text,
  add column first_scanned_at timestamptz;

comment on column public.tickets.check_code is
  'v2 self-check-in possession token (22-char base64url, 128-bit). URL: mesita.ai/check/<code>. Null on legacy staff-created rows.';
comment on column public.tickets.first_scanned_at is
  'First public check-web-get-ticket view. Surfaced on the check page ("scanned N min ago") so staff can spot stale/forwarded QRs.';

create unique index tickets_check_code_key
  on public.tickets (check_code)
  where check_code is not null;

-- QR-farming guard: one LIVE consumer-created ticket per guest × place. The
-- create EF checks first for a friendly 409; this index wins the race.
create unique index tickets_one_open_check_per_consumer_place
  on public.tickets (consumer_id, project_id)
  where status = 'open' and check_code is not null;

-- 2 — Audit trail for the public (verify_jwt=false) endpoints. Every scan and
--     mutation logs here; the ip_hash index doubles as the rate limiter
--     (count rows per ip_hash per minute inside the EF — no new infra).
--     self_view = the request carried the ticket owner's own consumer JWT
--     (getOptionalAuthedUser), which makes lazy self-service auditable.
create table public.ticket_check_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_id  uuid not null references public.tickets(id) on delete cascade,
  event      text not null check (event in (
    'scanned', 'bill_submitted', 'story_approved', 'story_rejected',
    'review_approved', 'review_rejected', 'marked_paid'
  )),
  self_view  boolean not null default false,
  -- sha256(ip + daily salt) — never the raw IP.
  ip_hash    text,
  user_agent text
);

create index ticket_check_events_ticket_idx
  on public.ticket_check_events (ticket_id, created_at);
create index ticket_check_events_ip_idx
  on public.ticket_check_events (ip_hash, created_at desc);

-- EF-only lockdown: RLS on, zero policies (the deliberate pattern — adding
-- policies here would OPEN access).
alter table public.ticket_check_events enable row level security;

-- 3 — admin_reset_database: add ticket_check_events to the truncate list.
--     Patched SURGICALLY off the live definition (never re-declared from a
--     repo copy — that is exactly how a stub once clobbered prod). Fails
--     loudly if the anchor is not found verbatim.
do $patch$
declare
  def text;
  patched text;
begin
  select pg_get_functiondef(p.oid)
    into def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'admin_reset_database';

  if def is null then
    raise exception 'admin_reset_database not found';
  end if;

  if position('public.ticket_check_events' in def) > 0 then
    -- Already patched (re-run safety).
    return;
  end if;

  patched := replace(
    def,
    E'truncate table\n    public.ticket_reviews,',
    E'truncate table\n    public.ticket_check_events,\n    public.ticket_reviews,'
  );

  if patched = def then
    raise exception 'admin_reset_database truncate anchor not found — inspect live body before patching';
  end if;

  execute patched;
end
$patch$;
