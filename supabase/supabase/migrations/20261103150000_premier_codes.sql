-- MESITA-3167 — Premier codes (Pato, 2026-11-03, Premier plan item 3):
-- a 100% code redeems Premier Refill days (tier, days), never a percentage.
--
--   premier_codes             one row per minted code; the plain code is never
--                             stored: code_hash = HMAC-SHA256(code, the EF
--                             secret PREMIER_CODE_PEPPER), last4 the label
--   premier_code_redemptions  one per (code, place): the code's uses
--   premier_code_attempts     every try, for the 10-per-user-per-hour limit
--
-- premier_redeem_code is the only redeemer: under a per-user lock it checks
-- the limit and records the attempt first, locks the code row, checks it,
-- then writes the days through premier_add_days (source code, request_id
-- code:<hmac>:<place_id>) and counts the use in the same transaction. A
-- refused redemption uses nothing. Revoking sets expires_at = now(): days
-- already redeemed keep running (CEO D5).
--
-- Data: new tables, nothing to backfill.

-- ── Tables ──────────────────────────────────────────────────────────────
create table public.premier_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  last4 text not null check (last4 ~ '^[0-9A-HJKMNP-TV-Z]{4}$'),
  tier smallint not null check (tier between 1 and 2),
  days integer not null check (days between 1 and 366),
  max_redemptions integer not null check (max_redemptions between 1 and 100000),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table public.premier_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.premier_codes (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (code_id, place_id)
);

create table public.premier_code_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index premier_code_attempts_user_at on public.premier_code_attempts (user_id, at);

alter table public.premier_codes enable row level security;
alter table public.premier_code_redemptions enable row level security;
alter table public.premier_code_attempts enable row level security;
revoke all on public.premier_codes, public.premier_code_redemptions, public.premier_code_attempts from anon, authenticated;

comment on table public.premier_codes is
  'MESITA-3167 Premier codes: a 100% code redeems tier (1 = 2X, 2 = 5X) for days of Premier Refill. code_hash = HMAC-SHA256 of the 8-character Crockford code with the EF secret PREMIER_CODE_PEPPER; the plain code is shown once at mint. Revoked = expires_at and revoked_at set to now(); redeemed days stay. EF-only.';
comment on table public.premier_code_redemptions is
  'MESITA-3167: one use of a code on a place (one per code and place), written only by premier_redeem_code with the days. EF-only.';
comment on table public.premier_code_attempts is
  'MESITA-3167: every counted redemption try, for the 10-per-user-per-hour limit shared by the Consumer App and Business. EF-only.';

-- ── Redeem ──────────────────────────────────────────────────────────────
-- Returns { result: "ok", tier, days, ends_at_2x, ends_at_5x, paused_tier,
-- paused_until } or { result: "refused", code[, retry_after] }. Order:
-- rate_limited (not counted) → the attempt is recorded → code_unknown →
-- code_expired → code_used_here → code_exhausted → premier_add_days's own
-- refusals (not_found · archived · unlisted · paid_higher · cap_reached).
create or replace function public.premier_redeem_code(p_code_hash text, p_place_id uuid, p_user_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_code public.premier_codes;
  v_retry timestamptz;
  v_add jsonb;
  v_paid public.place_premier_periods;
begin
  if p_user_id is null or p_place_id is null or p_code_hash is null then
    raise exception 'premier_redeem_code: code_hash, place and user are required' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('premier_code_attempts:' || p_user_id::text));

  -- The 10th attempt inside the hour is the one whose hour must pass.
  select at + interval '1 hour' into v_retry
    from public.premier_code_attempts
   where user_id = p_user_id and at > now() - interval '1 hour'
   order by at desc
   offset 9 limit 1;
  if v_retry is not null then
    return jsonb_build_object('result', 'refused', 'code', 'rate_limited', 'retry_after', v_retry);
  end if;

  insert into public.premier_code_attempts (user_id) values (p_user_id);

  select * into v_code from public.premier_codes where code_hash = p_code_hash for update;
  if v_code.id is null then
    return jsonb_build_object('result', 'refused', 'code', 'code_unknown');
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('result', 'refused', 'code', 'code_expired');
  end if;
  if exists (select 1 from public.premier_code_redemptions where code_id = v_code.id and place_id = p_place_id) then
    return jsonb_build_object('result', 'refused', 'code', 'code_used_here');
  end if;
  if (select count(*) from public.premier_code_redemptions where code_id = v_code.id) >= v_code.max_redemptions then
    return jsonb_build_object('result', 'refused', 'code', 'code_exhausted');
  end if;

  v_add := public.premier_add_days(p_place_id, v_code.tier, v_code.days, 'code', p_user_id::text,
                                   'code:' || p_code_hash || ':' || p_place_id::text);
  if v_add ->> 'result' <> 'ok' then
    return v_add;
  end if;

  insert into public.premier_code_redemptions (code_id, place_id, user_id) values (v_code.id, p_place_id, p_user_id);

  -- The paid period these days pause, if any (premier_cover_paid ran inside
  -- premier_add_days).
  select * into v_paid
    from public.place_premier_periods
   where place_id = p_place_id and status = 'paid'
     and starts_at <= now() and ends_at > now() and covered_until > now()
   order by starts_at desc
   limit 1;

  return jsonb_build_object(
           'result', 'ok',
           'tier', v_code.tier,
           'days', v_code.days,
           'ends_at_2x', v_add -> 'ends_at_2x',
           'ends_at_5x', v_add -> 'ends_at_5x',
           'paused_tier', v_paid.tier,
           'paused_until', v_paid.covered_until);
end;
$function$;

revoke all on function public.premier_redeem_code(text, uuid, uuid) from public;
revoke execute on function public.premier_redeem_code(text, uuid, uuid) from anon, authenticated;
grant execute on function public.premier_redeem_code(text, uuid, uuid) to service_role;
