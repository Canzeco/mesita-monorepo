-- MESITA-3292 — a guest sends credit to a friend, at the same place.
--
-- Pato (2026-11-06 gate): sharing is word of mouth with value attached; same
-- place only. Built in test mode; live sending waits on the lawyer
-- (MESITA-3274) behind money_config.sending_live, which the EFs read and
-- which no migration sets.
--
-- The shape is a link, not a phone number: the sender picks an amount of
-- their Available credit at one place and gets a one-time link; the credit
-- leaves their balance at once (gift_out); whoever opens the link signed in
-- takes it (gift_in, Available at once); until then the sender can take it
-- back (gift_back). The credit never leaves the place, so it stays the
-- place's debt (Payments Flow v2): a gift moves who holds it, never how much
-- the place owes.
--
--   wallet_gifts            one link: sender, place, amount, the token's hash,
--                           open → claimed | taken_back.
--   wallet_entries.gift_id  the gift a gift_out, gift_in or gift_back names.
--   wallet_send_credit      lock the sender's pair, replay, spendable, the
--                           open-link cap, insert the gift and gift_out.
--   wallet_claim_gift       lock the gift row, refuse own / closed links, lock
--                           the friend's pair, gift_in, mark claimed.
--   wallet_take_back_gift   the sender's undo while the link is open.
--   wallet_place_outstanding counts open links (their gift_out took the
--                           credit off the sender, the place still owes it).
--
-- Additive: a new table, a nullable column, three new functions and a wider
-- kind check (W3's `refund` kind, MESITA-3307, kept as it was). Nothing
-- calls them until the EFs deploy.

-- ── 1. The gifts ─────────────────────────────────────────────────────────────
create table public.wallet_gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.consumers (id) on delete set null,
  recipient_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  livemode boolean not null default false,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'open' check (status in ('open', 'claimed', 'taken_back')),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  taken_back_at timestamptz,
  constraint wallet_gifts_claimed_chk check ((status = 'claimed') = (claimed_at is not null)),
  constraint wallet_gifts_taken_back_chk check ((status = 'taken_back') = (taken_back_at is not null))
);

create unique index wallet_gifts_request_idx on public.wallet_gifts (sender_id, request_id);
create index wallet_gifts_open_idx on public.wallet_gifts (sender_id, place_id) where status = 'open';
create index wallet_gifts_place_open_idx on public.wallet_gifts (place_id) where status = 'open';

alter table public.wallet_gifts enable row level security;
revoke all on table public.wallet_gifts from public, anon, authenticated;
grant all on table public.wallet_gifts to service_role;

comment on table public.wallet_gifts is
  'MESITA-3292 Wallet: credit a guest sends to a friend at the same place, as a one-time link. The token is hashed (sha256 of "gift-token:<token>"); the sender sees the link once. open → claimed (a signed-in friend took it) | taken_back (the sender undid it). Its entries: gift_out on send, gift_in on claim, gift_back on take-back. EF-only.';

-- ── 2. Entries name their gift ───────────────────────────────────────────────
alter table public.wallet_entries
  add column gift_id uuid references public.wallet_gifts (id) on delete restrict;

create index wallet_entries_gift_idx on public.wallet_entries (gift_id) where gift_id is not null;

alter table public.wallet_entries drop constraint if exists wallet_entries_kind_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_chk
  check (kind in ('prepay', 'voucher', 'bonus', 'cashback', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back'));

alter table public.wallet_entries drop constraint if exists wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
  case kind
    when 'prepay' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'voucher' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'bonus' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'cashback' then amount_cents > 0 and payment_id is not null and purchase_id is null and gift_id is null
    when 'spend' then amount_cents < 0 and payment_id is not null and purchase_id is null and gift_id is null
    when 'reversal' then amount_cents < 0 and (purchase_id is not null or payment_id is not null) and gift_id is null
    when 'refund' then amount_cents > 0 and payment_id is not null and purchase_id is null and gift_id is null
    when 'gift_out' then amount_cents < 0 and gift_id is not null and purchase_id is null and payment_id is null
    when 'gift_in' then amount_cents > 0 and gift_id is not null and purchase_id is null and payment_id is null
    when 'gift_back' then amount_cents > 0 and gift_id is not null and purchase_id is null and payment_id is null
    else false
  end
);

-- One of each per gift: a replay can never move the credit twice.
create unique index wallet_entries_gift_kind_once_idx on public.wallet_entries (gift_id, kind) where gift_id is not null;

comment on column public.wallet_entries.gift_id is
  'MESITA-3292: the wallet_gifts row a gift_out (sender, negative), gift_in (friend, positive) or gift_back (sender, positive) belongs to. Null on every other kind.';

-- ── 3. Sending ───────────────────────────────────────────────────────────────
-- Under the sender's pair lock: a replayed request_id with the same place and
-- amount answers the stored gift (the token cannot be shown again: it is
-- hashed; the client keeps the link it was given); any other use of it is
-- `taken`. Only spendable credit goes, and at most p_max_open links stay open
-- per (sender, place).
create or replace function public.wallet_send_credit(
  p_sender_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_token_hash text, p_max_open integer default 10)
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

  insert into public.wallet_gifts (sender_id, place_id, amount_cents, currency, livemode, token_hash, request_id)
  values (p_sender_id, p_place_id, p_amount_cents, p_currency, p_livemode, p_token_hash, p_request_id)
  returning id, created_at into v_id, v_at;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, gift_id, livemode, available_at)
  values (p_sender_id, p_place_id, 'gift_out', -p_amount_cents, p_currency, v_id, p_livemode, now());

  return jsonb_build_object('ok', true, 'outcome', 'sent', 'gift_id', v_id, 'status', 'open',
    'amount_cents', p_amount_cents, 'currency', p_currency, 'created_at', v_at);
end;
$function$;

revoke all on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer) to service_role;

comment on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer) is
  'MESITA-3292 Wallet: a guest sends spendable credit at one place as a one-time link. Under wallet_lock: a replayed request_id (same place, amount, livemode) answers already_sent; any other use answers taken; more than p_max_open open links at the place answers too_many_open; more than spendable answers insufficient; otherwise one open wallet_gifts row and one gift_out entry. Service role only.';

-- ── 4. Taking it ─────────────────────────────────────────────────────────────
-- The gift row is the lock that matters (FOR UPDATE): two friends opening one
-- link take it once. The friend's pair lock keeps their balance reads honest.
-- p_livemode must match the gift's universe: a test link never lands in live.
create or replace function public.wallet_claim_gift(p_token_hash text, p_recipient_id uuid, p_livemode boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_gifts;
begin
  if p_recipient_id is null or p_token_hash is null then
    raise exception 'wallet_claim_gift: recipient and token_hash are required';
  end if;

  select * into v from public.wallet_gifts where token_hash = p_token_hash for update;
  if not found or v.livemode <> p_livemode then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if v.status = 'claimed' then
    if v.recipient_id = p_recipient_id then
      return jsonb_build_object('ok', true, 'outcome', 'already_claimed', 'gift_id', v.id, 'place_id', v.place_id,
        'amount_cents', v.amount_cents, 'currency', v.currency, 'claimed_at', v.claimed_at);
    end if;
    return jsonb_build_object('ok', false, 'code', 'claimed');
  end if;
  if v.status = 'taken_back' then
    return jsonb_build_object('ok', false, 'code', 'taken_back');
  end if;
  if v.sender_id = p_recipient_id then
    return jsonb_build_object('ok', false, 'code', 'own_gift');
  end if;

  perform public.wallet_lock(p_recipient_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, gift_id, livemode, available_at)
  values (p_recipient_id, v.place_id, 'gift_in', v.amount_cents, v.currency, v.id, v.livemode, now());

  update public.wallet_gifts
     set status = 'claimed', recipient_id = p_recipient_id, claimed_at = now()
   where id = v.id
  returning * into v;

  return jsonb_build_object('ok', true, 'outcome', 'claimed', 'gift_id', v.id, 'place_id', v.place_id,
    'amount_cents', v.amount_cents, 'currency', v.currency, 'claimed_at', v.claimed_at);
end;
$function$;

revoke all on function public.wallet_claim_gift(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.wallet_claim_gift(text, uuid, boolean) to service_role;

comment on function public.wallet_claim_gift(text, uuid, boolean) is
  'MESITA-3292 Wallet: a signed-in friend takes an open gift link. The gift row is locked FOR UPDATE: once only. Refuses gone (no such link in this universe), claimed (someone else took it), taken_back, own_gift; the same friend again answers already_claimed. Writes one gift_in entry, Available at once. Service role only.';

-- ── 5. Taking it back ────────────────────────────────────────────────────────
create or replace function public.wallet_take_back_gift(p_gift_id uuid, p_sender_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_gifts;
begin
  if p_sender_id is null or p_gift_id is null then
    raise exception 'wallet_take_back_gift: gift and sender are required';
  end if;

  select * into v from public.wallet_gifts where id = p_gift_id and sender_id = p_sender_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if v.status = 'taken_back' then
    return jsonb_build_object('ok', true, 'outcome', 'already_taken_back', 'gift_id', v.id,
      'amount_cents', v.amount_cents, 'currency', v.currency);
  end if;
  if v.status = 'claimed' then
    return jsonb_build_object('ok', false, 'code', 'claimed');
  end if;

  perform public.wallet_lock(p_sender_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, gift_id, livemode, available_at)
  values (p_sender_id, v.place_id, 'gift_back', v.amount_cents, v.currency, v.id, v.livemode, now());

  update public.wallet_gifts set status = 'taken_back', taken_back_at = now() where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'taken_back', 'gift_id', v.id,
    'amount_cents', v.amount_cents, 'currency', v.currency);
end;
$function$;

revoke all on function public.wallet_take_back_gift(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_take_back_gift(uuid, uuid) to service_role;

comment on function public.wallet_take_back_gift(uuid, uuid) is
  'MESITA-3292 Wallet: the sender undoes an open gift link: one gift_back entry, Available at once, and the link reads taken_back. A claimed link answers claimed; a second take-back answers already_taken_back. Service role only.';

-- ── 6. What the place owes counts open links ─────────────────────────────────
create or replace function public.wallet_place_outstanding(p_place_id uuid, p_currency text, p_livemode boolean)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select (
    coalesce((select sum(amount_cents) from public.wallet_entries
               where place_id = p_place_id and currency = lower(p_currency) and livemode = p_livemode), 0)
    + coalesce((select sum(amount_cents) from public.wallet_gifts
               where place_id = p_place_id and currency = lower(p_currency) and livemode = p_livemode
                 and status = 'open'), 0)
  )::integer;
$function$;

revoke all on function public.wallet_place_outstanding(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_place_outstanding(uuid, text, boolean) to service_role;

-- ── 7. Post-flight ───────────────────────────────────────────────────────────
-- The kind checks were rewritten whole: every kind an earlier wave added must
-- still be there.
do $$
declare k text;
begin
  foreach k in array array['prepay', 'voucher', 'bonus', 'cashback', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back'] loop
    if not exists (select 1 from pg_constraint where conname = 'wallet_entries_kind_shape_chk'
                   and pg_get_constraintdef(oid) like '%''' || k || '''%') then
      raise exception 'kind % is missing from wallet_entries_kind_shape_chk', k;
    end if;
  end loop;
end $$;
