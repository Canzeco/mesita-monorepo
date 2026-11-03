-- MESITA-3127: the claim works. Two ways to prove you run a place:
--   1. A call to the place's listing phone that says a 6-digit code
--      (business-web-call-place-code → business-web-check-place-code).
--   2. Mesita checks by hand: the request now carries a WhatsApp number
--      Mesita writes to (business-web-request-verification).
--
-- place_verification_codes holds the one live code per (place, guest), as a
-- hash only. A new call replaces it; the right code deletes it and calls
-- place_verification_approve (method 'phone_code'). Calls are still counted
-- by place_take_verification_send (3 per place, 5 per guest a rolling day).

create table public.place_verification_codes (
  place_id uuid not null references public.places (id) on delete cascade,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  code_hash text not null check (char_length(code_hash) = 64),
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (place_id, consumer_id)
);

alter table public.place_verification_codes enable row level security;
revoke all on table public.place_verification_codes from public, anon, authenticated;
grant all on table public.place_verification_codes to service_role;

comment on table public.place_verification_codes is
  'MESITA-3127 The live claim code a call said to a place''s listing phone: one per (place, guest), SHA-256 only, 10 minutes, 5 tries. Written by business-web-call-place-code, spent by business-web-check-place-code. EF-only.';

alter table public.place_verification_requests
  add column contact text check (contact is null or char_length(contact) between 7 and 40);

comment on column public.place_verification_requests.contact is
  'MESITA-3127 The WhatsApp number Mesita writes to while checking the claim by hand. Required for new requests (the EF); null on older rows.';

-- ── place_take_code_try ──────────────────────────────────────────────────
-- Spends one try before the code is compared, in one statement, so parallel
-- guesses each pay a try. Returns the hash while the code is live and tries
-- remain, else null.
create or replace function public.place_take_code_try(p_place_id uuid, p_consumer_id uuid, p_max integer)
 returns text
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.place_verification_codes
     set attempts = attempts + 1
   where place_id = p_place_id and consumer_id = p_consumer_id
     and attempts < p_max and expires_at > now()
  returning code_hash;
$function$;

revoke all on function public.place_take_code_try(uuid, uuid, integer) from public;
revoke execute on function public.place_take_code_try(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.place_take_code_try(uuid, uuid, integer) to service_role;
