-- MESITA-3737 — a sent credit link also carries a 12-digit code.
--
-- Pato (2026-11-11): gifts stay a link; the code is the same gift for the
-- rare case of reading it aloud or writing it on a card. Twelve digits (an
-- 8-digit code is too easy to guess), drawn at random by the EF, stored only
-- as a hash, and never recycled: the unique index covers every row, open or
-- closed, and nothing ever clears a code_hash.
--
--   wallet_gifts.code_hash     sha256 of "gift-code:<12 digits>"; null on
--                              links sent before this migration.
--   wallet_gift_code_tries     one row per wrong code a guest typed.
--   wallet_send_credit         takes p_code_hash (default null, so the EF
--                              still deployed keeps working until it
--                              redeploys).
--   wallet_claim_gift_code     at most p_max_misses wrong codes per guest per
--                              hour, then too_many_tries; a right code is
--                              wallet_claim_gift on that gift's link.

-- ── 1. The code ──────────────────────────────────────────────────────────────
alter table public.wallet_gifts
  add column code_hash text check (code_hash ~ '^[0-9a-f]{64}$');

create unique index wallet_gifts_code_hash_idx on public.wallet_gifts (code_hash) where code_hash is not null;

comment on column public.wallet_gifts.code_hash is
  'MESITA-3737: sha256 of "gift-code:<12 digits>", the code a friend can type in the Wallet instead of opening the link. Unique across every row and never cleared, so a code is never reused. Null on links sent before 2026-11-11.';

-- ── 2. Wrong codes ───────────────────────────────────────────────────────────
create table public.wallet_gift_code_tries (
  id bigint generated always as identity primary key,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  tried_at timestamptz not null default now()
);

create index wallet_gift_code_tries_consumer_idx on public.wallet_gift_code_tries (consumer_id, tried_at desc);

alter table public.wallet_gift_code_tries enable row level security;
revoke all on table public.wallet_gift_code_tries from public, anon, authenticated;
grant all on table public.wallet_gift_code_tries to service_role;

comment on table public.wallet_gift_code_tries is
  'MESITA-3737 Wallet: one row per wrong gift code a guest typed; wallet_claim_gift_code counts the last hour. EF-only.';

-- ── 3. Sending carries the code ──────────────────────────────────────────────
drop function if exists public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer);

create or replace function public.wallet_send_credit(
  p_sender_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_token_hash text, p_max_open integer default 10,
  p_code_hash text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_gifts;
  v_spendable integer;
  v_open integer;
  v_id uuid;
  v_at timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_sender_id is null or p_request_id is null or p_token_hash is null then
    raise exception 'wallet_send_credit: sender, request_id and token_hash are required';
  end if;
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_sender_id, p_place_id);

  select * into v_prior from public.wallet_gifts
   where sender_id = p_sender_id and request_id = p_request_id;
  if found then
    if v_prior.place_id = p_place_id and v_prior.amount_cents = p_amount_cents and v_prior.livemode = p_livemode then
      return jsonb_build_object('ok', true, 'outcome', 'already_sent', 'gift_id', v_prior.id,
        'status', v_prior.status, 'amount_cents', v_prior.amount_cents, 'currency', v_prior.currency,
        'created_at', v_prior.created_at);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'gift_id', v_prior.id);
  end if;

  select count(*)::integer into v_open from public.wallet_gifts
   where sender_id = p_sender_id and place_id = p_place_id and status = 'open';
  if v_open >= p_max_open then
    return jsonb_build_object('ok', false, 'code', 'too_many_open', 'open', v_open);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_sender_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_amount_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  insert into public.wallet_gifts (sender_id, place_id, amount_cents, currency, livemode, token_hash, code_hash, request_id)
  values (p_sender_id, p_place_id, p_amount_cents, p_currency, p_livemode, p_token_hash, p_code_hash, p_request_id)
  returning id, created_at into v_id, v_at;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, gift_id, livemode, available_at)
  values (p_sender_id, p_place_id, 'gift_out', -p_amount_cents, p_currency, v_id, p_livemode, now());

  return jsonb_build_object('ok', true, 'outcome', 'sent', 'gift_id', v_id, 'status', 'open',
    'amount_cents', p_amount_cents, 'currency', p_currency, 'created_at', v_at);
end;
$function$;

revoke all on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text) to service_role;

comment on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text) is
  'MESITA-3292 Wallet: a guest sends spendable credit at one place as a one-time link (MESITA-3737: and a 12-digit code, p_code_hash). Under wallet_lock: a replayed request_id (same place, amount, livemode) answers already_sent; any other use answers taken; more than p_max_open open links at the place answers too_many_open; more than spendable answers insufficient; otherwise one open wallet_gifts row and one gift_out entry. Service role only.';

-- ── 4. Taking it by code ─────────────────────────────────────────────────────
-- The guest's advisory lock serialises their tries, so parallel requests
-- cannot slip past the count. A wrong code (none in this universe) is one
-- try; a right code is the link's own claim, with its refusals.
create or replace function public.wallet_claim_gift_code(
  p_code_hash text, p_recipient_id uuid, p_livemode boolean, p_max_misses integer default 5)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_misses integer;
  v_token_hash text;
begin
  if p_recipient_id is null or p_code_hash is null then
    raise exception 'wallet_claim_gift_code: recipient and code_hash are required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gift-code:' || p_recipient_id::text, 0));

  select count(*)::integer into v_misses from public.wallet_gift_code_tries
   where consumer_id = p_recipient_id and tried_at > now() - interval '1 hour';
  if v_misses >= p_max_misses then
    return jsonb_build_object('ok', false, 'code', 'too_many_tries');
  end if;

  select token_hash into v_token_hash from public.wallet_gifts
   where code_hash = p_code_hash and livemode = p_livemode;
  if not found then
    insert into public.wallet_gift_code_tries (consumer_id) values (p_recipient_id);
    return jsonb_build_object('ok', false, 'code', 'gone', 'tries_left', greatest(p_max_misses - v_misses - 1, 0));
  end if;

  return public.wallet_claim_gift(v_token_hash, p_recipient_id, p_livemode);
end;
$function$;

revoke all on function public.wallet_claim_gift_code(text, uuid, boolean, integer) from public, anon, authenticated;
grant execute on function public.wallet_claim_gift_code(text, uuid, boolean, integer) to service_role;

comment on function public.wallet_claim_gift_code(text, uuid, boolean, integer) is
  'MESITA-3737 Wallet: a signed-in friend types a gift''s 12-digit code. After p_max_misses wrong codes in an hour it answers too_many_tries; a wrong code answers gone and counts one try; a right one answers exactly as wallet_claim_gift on that gift. Service role only.';
