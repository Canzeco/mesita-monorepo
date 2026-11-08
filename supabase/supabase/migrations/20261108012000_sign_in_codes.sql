-- MESITA-3405: phone sign-in by SMS or call.
--
-- Supabase Auth only texts its code, so a call needs that code too. The
-- Send SMS hook (supabase-auth-send-sms) keeps the latest code per phone for
-- its 5 minutes; consumer-web-call-sign-in-code says it by phone. Supabase
-- Auth still checks the code; this table only lets a call repeat it.

create table public.sign_in_codes (
  phone text primary key check (phone ~ '^\+[0-9]{8,15}$'),
  code text not null check (code ~ '^[0-9]{4,10}$'),
  calls integer not null default 0 check (calls >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.sign_in_codes enable row level security;
revoke all on table public.sign_in_codes from public, anon, authenticated;
grant all on table public.sign_in_codes to service_role;

comment on table public.sign_in_codes is
  'MESITA-3405 The latest phone sign-in code per number, kept for its 5 minutes so a call can say it. Written by supabase-auth-send-sms, read by consumer-web-call-sign-in-code. EF-only.';

-- ── sign_in_code_take_call ──────────────────────────────────────────────
-- Spends one call on the live code in one statement, so parallel taps each
-- pay. Returns the code while it is live and calls remain, else null.
create or replace function public.sign_in_code_take_call(p_phone text, p_max integer)
 returns text
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.sign_in_codes
     set calls = calls + 1
   where phone = p_phone and calls < p_max and expires_at > now()
  returning code;
$function$;

revoke all on function public.sign_in_code_take_call(text, integer) from public, anon, authenticated;
grant execute on function public.sign_in_code_take_call(text, integer) to service_role;
