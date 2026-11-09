-- MESITA-3470: phone sign-in asks "text or call" up front.
--
-- MESITA-3405 kept every texted code so a call could repeat it, which made a
-- call wait for an SMS. Now the guest picks Call first:
-- consumer-web-call-sign-in-code marks the number here, the browser asks
-- Supabase Auth for a code, and the Send SMS hook (supabase-auth-send-sms)
-- sees the mark and calls instead of texting. Auth still makes and checks the
-- code; no code is stored any more.

drop function if exists public.sign_in_code_take_call(text, integer);
drop table if exists public.sign_in_codes;

create table public.sign_in_calls (
  phone text primary key check (phone ~ '^\+[0-9]{8,15}$'),
  requested_at timestamptz,
  called_at timestamptz
);

alter table public.sign_in_calls enable row level security;
revoke all on table public.sign_in_calls from public, anon, authenticated;
grant all on table public.sign_in_calls to service_role;

comment on table public.sign_in_calls is
  'MESITA-3470 Phone sign-in by call. requested_at: the guest picked Call (consumer-web-call-sign-in-code); the Send SMS hook (supabase-auth-send-sms) calls instead of texting while it is under 2 minutes old, then clears it and stamps called_at. EF-only.';
