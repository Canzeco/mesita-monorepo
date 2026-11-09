-- MESITA-3540 (the remainder of MESITA-3055): real VIP invitation codes.
--
-- Until now consumer-web-join-class made anyone who sent twelve zeros a VIP
-- (the emulator code, MESITA-3071). VIP will gate the VIP voucher, so a code
-- is now something an operator issues on Admin › Guests and a guest uses once.
--
--   vip_invitation_codes     one row per issued code. Only the SHA-256 of the
--                            twelve digits and the last four are stored; the
--                            operator sees the code once, when it is issued.
--                            One use (used_by/used_at), or revoked unused.
--                            label says who it was for; vip_partner_id is
--                            the partner the guest's VIP then comes through.
--   vip_invitation_attempts  every code a guest typed (outcome + last four).
--                            The rate limit reads it: 10 wrong codes in an
--                            hour per guest, then refused. 10/h against 10^12
--                            codes cannot be brute-forced.
--   consumer_redeem_vip_invitation(p_consumer, p_code)
--                            the one redeem: locks the guest's row, checks
--                            the limit, uses the code and makes the guest VIP
--                            through admin_set_guest_standing in ONE
--                            transaction, so no code is used up without the
--                            class change. Returns the outcome as text.
--
-- Both tables are EF-only: RLS on, no policy, no client grant.

-- (a) The codes.
create table if not exists public.vip_invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_last4 text not null,
  label text,
  vip_partner_id uuid references public.vip_partners (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  used_by uuid references public.consumers (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  constraint vip_invitation_codes_hash_check check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint vip_invitation_codes_last4_check check (code_last4 ~ '^[0-9]{4}$'),
  constraint vip_invitation_codes_label_check
    check (label is null or (label = btrim(label) and char_length(label) between 1 and 80)),
  constraint vip_invitation_codes_used_check check (used_at is not null or used_by is null),
  constraint vip_invitation_codes_one_end_check check (used_at is null or revoked_at is null)
);
create index if not exists vip_invitation_codes_created_at_idx
  on public.vip_invitation_codes (created_at desc);

alter table public.vip_invitation_codes enable row level security;
revoke all on table public.vip_invitation_codes from public, anon, authenticated;
grant select, insert, update, delete on table public.vip_invitation_codes to service_role;

comment on table public.vip_invitation_codes is
  'MESITA-3540: VIP invitation codes an operator issues (admin-web-save-vip-code). Only sha256(12 digits) and the last four are stored; one use, or revoked unused. Redeemed only by consumer_redeem_vip_invitation. EF-only.';

-- (b) The attempt log.
create table if not exists public.vip_invitation_attempts (
  id bigint generated always as identity primary key,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  code_last4 text,
  outcome text not null,
  created_at timestamptz not null default now(),
  constraint vip_invitation_attempts_outcome_check
    check (outcome in ('joined', 'already_vip', 'invalid', 'used', 'revoked', 'rate_limited'))
);
create index if not exists vip_invitation_attempts_consumer_idx
  on public.vip_invitation_attempts (consumer_id, created_at desc);

alter table public.vip_invitation_attempts enable row level security;
revoke all on table public.vip_invitation_attempts from public, anon, authenticated;
grant select, insert, delete on table public.vip_invitation_attempts to service_role;

comment on table public.vip_invitation_attempts is
  'MESITA-3540: every VIP code a guest typed, with its outcome. invalid/used/revoked count toward the limit of 10 an hour per guest. Written only by consumer_redeem_vip_invitation. EF-only.';

-- (c) The redeem.
create or replace function public.consumer_redeem_vip_invitation(
  p_consumer uuid,
  p_code text
) returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_class text;
  v_note text;
  v_last4 text;
  v_hash text;
  v_fails integer;
  v_code public.vip_invitation_codes%rowtype;
  v_miss text;
  v_join text;
  v_merged text;
begin
  if p_code is null or p_code !~ '^[0-9]{12}$' then
    raise exception 'p_code must be twelve digits' using errcode = '22023';
  end if;
  v_last4 := right(p_code, 4);
  v_hash := encode(sha256(convert_to(p_code, 'UTF8')), 'hex');

  -- The guest's row, locked: two taps from one guest run one after the other,
  -- so the limit below cannot be raced.
  select c.guest_class, c.guest_class_note into v_class, v_note
    from public.consumers c
   where c.id = p_consumer and c.deleted_at is null
   for update;
  if not found then
    return 'consumer_not_found';
  end if;

  if v_class = 'vip' then
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, 'already_vip');
    return 'already_vip';
  end if;

  select count(*) into v_fails
    from public.vip_invitation_attempts a
   where a.consumer_id = p_consumer
     and a.outcome in ('invalid', 'used', 'revoked')
     and a.created_at > now() - interval '1 hour';
  if v_fails >= 10 then
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, 'rate_limited');
    return 'rate_limited';
  end if;

  update public.vip_invitation_codes k
     set used_by = p_consumer,
         used_at = now()
   where k.code_hash = v_hash
     and k.used_at is null
     and k.revoked_at is null
  returning k.* into v_code;

  if not found then
    -- The log keeps why; the guest hears one answer for all three, so a
    -- typed code never tells them whether it exists.
    select case when k.revoked_at is not null then 'revoked' else 'used' end into v_miss
      from public.vip_invitation_codes k
     where k.code_hash = v_hash;
    insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
    values (p_consumer, v_last4, coalesce(v_miss, 'invalid'));
    return 'invalid';
  end if;

  -- The note says how this VIP joined, in front of any operator note, cut to
  -- the column's 280.
  v_join := '[code] Joined with code …' || v_last4 || coalesce(' · ' || v_code.label, '');
  v_merged := case
    when nullif(btrim(coalesce(v_note, '')), '') is null then v_join
    else v_join || ' · ' || btrim(v_note)
  end;
  if char_length(v_merged) > 280 then
    v_merged := left(v_merged, 279) || '…';
  end if;

  perform public.admin_set_guest_standing(
    p_consumer, 'vip', null,
    v_merged, true,
    v_code.vip_partner_id, v_code.vip_partner_id is not null,
    null, false,
    null
  );

  insert into public.vip_invitation_attempts (consumer_id, code_last4, outcome)
  values (p_consumer, v_last4, 'joined');
  return 'joined';
end;
$$;

revoke execute on function public.consumer_redeem_vip_invitation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.consumer_redeem_vip_invitation(uuid, text)
  to service_role;

comment on function public.consumer_redeem_vip_invitation(uuid, text) is
  'MESITA-3540: a guest uses a VIP invitation code. One transaction: lock the guest, 10 wrong codes an hour max, use the code once, admin_set_guest_standing to VIP with the code''s partner and a [code] note. Returns joined · already_vip · invalid · rate_limited · consumer_not_found. Service role only (consumer-web-join-class).';
