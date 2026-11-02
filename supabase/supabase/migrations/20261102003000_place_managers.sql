-- MESITA-3103 — who runs a place (web-business on real data).
--
-- MESITA-3093 (Premier c, approved 2026-10-29) specified "prove you run the
-- place": a code to the place's Google phone, or a manual review a
-- super-admin approves, writing a manager row. It deferred E6, "the manager
-- row becoming business ownership". This migration is that row, built now as
-- ownership: a live row lets its guest open the place in the Business app,
-- edit its profile and manage its Premier.
--
--   place_managers               who runs a place, until when, proved how
--   place_verification_requests  the manual review queue (name, role, note)
--   place_verification_sends     the code channel's rate-limit log; created
--                                for MESITA-3093's Twilio codes, written by
--                                nothing until that ships
--
-- An owner is a consumers row (Premier's payer FK is consumers), so every
-- guest foreign key cascades with consumer-web-delete-account.
--
-- All three tables are EF-only: RLS on, no policy, client roles hold nothing.
-- The business-web-* Edge Functions read and write them with the service
-- role; the approval and the send log go through the RPCs below so their
-- checks hold under concurrency.

-- ── place_managers ───────────────────────────────────────────────────────
create table public.place_managers (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  -- phone_match: the signed-in phone is the listing's phone.
  -- phone_code:  a code sent to the listing's phone (MESITA-3093).
  -- review:      a super-admin approved a manual request.
  method text not null check (method in ('phone_match', 'phone_code', 'review')),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by text,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > verified_at)
);

-- One row per (place, guest) while it is not revoked, live or expired: a
-- re-verification extends that row (place_verification_approve).
create unique index place_managers_one_per_guest
  on public.place_managers (place_id, consumer_id) where revoked_at is null;
create index place_managers_place_idx
  on public.place_managers (place_id) where revoked_at is null;
create index place_managers_consumer_idx
  on public.place_managers (consumer_id) where revoked_at is null;

alter table public.place_managers enable row level security;
revoke all on table public.place_managers from public, anon, authenticated;
grant all on table public.place_managers to service_role;

comment on table public.place_managers is
  'MESITA-3103 Who runs a place: live = revoked_at null and expires_at > now(). Grants the Business app (profile, Premier, settings) on that place only. Written by place_verification_approve and business-web-* EFs. EF-only. MESITA-3093 reads it for Premier take-over.';

-- ── place_verification_requests ──────────────────────────────────────────
create table public.place_verification_requests (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  role text not null check (char_length(btrim(role)) between 1 and 80),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_email text,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((status = 'pending') = (decided_at is null))
);

create unique index place_verification_requests_one_pending
  on public.place_verification_requests (place_id, consumer_id) where status = 'pending';
create index place_verification_requests_pending_idx
  on public.place_verification_requests (created_at) where status = 'pending';
create index place_verification_requests_consumer_idx
  on public.place_verification_requests (consumer_id, created_at);

alter table public.place_verification_requests enable row level security;
revoke all on table public.place_verification_requests from public, anon, authenticated;
grant all on table public.place_verification_requests to service_role;

comment on table public.place_verification_requests is
  'MESITA-3103 Manual "I run this place" requests: pending until a super-admin approves (place_verification_approve) or rejects them in the Business app''s Internal page. One pending per (place, guest). EF-only.';

-- ── place_verification_sends ─────────────────────────────────────────────
create table public.place_verification_sends (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'call')),
  sent_at timestamptz not null default now()
);

create index place_verification_sends_place_idx on public.place_verification_sends (place_id, sent_at);
create index place_verification_sends_consumer_idx on public.place_verification_sends (consumer_id, sent_at);

alter table public.place_verification_sends enable row level security;
revoke all on table public.place_verification_sends from public, anon, authenticated;
grant all on table public.place_verification_sends to service_role;

comment on table public.place_verification_sends is
  'MESITA-3093 / MESITA-3103 Code sends to a place''s listing phone, for the rolling-24h limits in place_take_verification_send. No code is stored here. EF-only.';

-- ── place_take_verification_send ─────────────────────────────────────────
-- Records a send if the limits allow it: 3 per place and 5 per guest over the
-- last 24 hours. Checked and recorded under one place lock, so two requests
-- in flight cannot both take the third slot.
create or replace function public.place_take_verification_send(
  p_place_id uuid,
  p_consumer_id uuid,
  p_channel text
)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_place integer;
  v_guest integer;
begin
  perform pg_advisory_xact_lock(hashtext('place_verification:' || p_place_id::text));
  select count(*) into v_place from public.place_verification_sends
   where place_id = p_place_id and sent_at > now() - interval '24 hours';
  if v_place >= 3 then
    return 'place_limit';
  end if;
  select count(*) into v_guest from public.place_verification_sends
   where consumer_id = p_consumer_id and sent_at > now() - interval '24 hours';
  if v_guest >= 5 then
    return 'guest_limit';
  end if;
  insert into public.place_verification_sends (place_id, consumer_id, channel)
  values (p_place_id, p_consumer_id, p_channel);
  return 'ok';
end;
$function$;

-- ── place_verification_approve ───────────────────────────────────────────
-- The one write that makes a guest run a place. Under the place lock it
-- upserts the (place, guest) row — an existing row, expired or live, is
-- re-verified and extended — and, when a request is named, closes it as
-- approved in the same transaction, so the queue and the row never disagree.
-- Returns the manager row id, or null when the named request is not pending
-- (approved twice, rejected, or for another place/guest).
create or replace function public.place_verification_approve(
  p_place_id uuid,
  p_consumer_id uuid,
  p_method text,
  p_days integer,
  p_request_id uuid default null,
  p_reviewer text default null,
  p_note text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_days is null or p_days < 1 or p_days > 730 then
    raise exception 'place_verification_approve: days out of range (%)', p_days;
  end if;
  perform pg_advisory_xact_lock(hashtext('place_verification:' || p_place_id::text));

  if p_request_id is not null then
    update public.place_verification_requests
       set status = 'approved', decided_at = now(), reviewer_email = p_reviewer,
           decision_note = p_note
     where id = p_request_id and place_id = p_place_id and consumer_id = p_consumer_id
       and status = 'pending';
    if not found then
      return null;
    end if;
  end if;

  update public.place_managers
     set method = p_method, verified_at = now(), expires_at = now() + make_interval(days => p_days),
         note = coalesce(p_note, note), updated_at = now()
   where place_id = p_place_id and consumer_id = p_consumer_id and revoked_at is null
  returning id into v_id;

  if v_id is null then
    insert into public.place_managers (place_id, consumer_id, method, expires_at, note)
    values (p_place_id, p_consumer_id, p_method, now() + make_interval(days => p_days), p_note)
    returning id into v_id;
  end if;

  -- A guest who runs the place has nothing left to ask: close any other
  -- pending request of theirs for it.
  update public.place_verification_requests
     set status = 'approved', decided_at = now(), reviewer_email = coalesce(p_reviewer, reviewer_email),
         decision_note = coalesce(decision_note, 'Verified by ' || p_method)
   where place_id = p_place_id and consumer_id = p_consumer_id and status = 'pending';

  return v_id;
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.place_take_verification_send(uuid, uuid, text)',
    'public.place_verification_approve(uuid, uuid, text, integer, uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
