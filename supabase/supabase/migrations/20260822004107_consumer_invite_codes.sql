-- Invite PINs — the TRANSFERABLE invitation door (MESITA-1168).
--
-- The other door, admin-web-grant-class, names a consumer Mesita already has
-- (uuid, phone, @handle). That cannot serve the case this table exists for:
-- hand a partner — a modelling agency, a venue, an event — 50 Diamond PINs to
-- distribute to people Mesita has never met and has no phone number for. A
-- bearer PIN is the only shape that survives that hand-off.
--
-- It also removes the need for a pending-grant-by-phone table: the PIN IS the
-- deferred grant. The holder signs up whenever they like, enters the PIN, and
-- the invitation door opens then.
--
-- class_key FKs to public.classes, so a PIN speaks LEGACY keys — a Diamond PIN
-- stores 'aura'. This is deliberate: it means the database itself refuses a PIN
-- for a class that cannot be granted (there is no 'gold' row), rather than
-- letting one be minted and fail at redemption.
--
-- Single-use by construction: claimed_at/claimed_by move together, and the
-- claim is an atomic UPDATE ... WHERE claimed_at IS NULL, mirroring the guard
-- business-web-accept-invite already uses on project_invites.
--
-- RLS is ON with NO policies, which is the repo's client-never-touches-the-DB
-- rule expressed in the schema: only the service role (i.e. an Edge Function)
-- can read or write. A PIN table readable from a client would be a PIN table
-- that can be enumerated.

create table if not exists public.consumer_invite_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text        not null unique,
  class_key    text        not null references public.classes(key),
  batch_label  text,
  note         text,
  expires_at   timestamptz,
  claimed_at   timestamptz,
  claimed_by   uuid        references auth.users(id) on delete set null,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint consumer_invite_codes_code_is_10_digits
    check (code ~ '^[0-9]{10}$'),
  -- A claim is both facts or neither; half a claim is a PIN in limbo.
  constraint consumer_invite_codes_claim_is_whole
    check ((claimed_at is null) = (claimed_by is null))
);

-- Batch reporting: "the agency handed out 37 of the 50 we gave them."
create index if not exists consumer_invite_codes_batch_idx
  on public.consumer_invite_codes (batch_label);

-- The redemption lookup and the unclaimed sweep both read this.
create index if not exists consumer_invite_codes_unclaimed_idx
  on public.consumer_invite_codes (claimed_at)
  where claimed_at is null;

-- One consumer cannot burn two PINs; the second is pointless anyway because
-- the door recompute already settles the slot from the highest open door.
create unique index if not exists consumer_invite_codes_one_per_claimer_idx
  on public.consumer_invite_codes (claimed_by)
  where claimed_by is not null;

alter table public.consumer_invite_codes enable row level security;

comment on table public.consumer_invite_codes is
  'Bearer invite PINs (10 digits) that grant a class on redemption. Service-role only: RLS is on with no policies on purpose. Redeemed via consumer-web-claim-invite-code, minted via admin-web-mint-invite-codes.';
