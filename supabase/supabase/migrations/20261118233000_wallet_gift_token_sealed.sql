-- MESITA-4390 — an open gift's link can be shown to its sender again.
--
-- Pato (2026-11-18): "if i click to create gift, but i already have gift
-- oepns, like show the prev list as a prev step … select current and copy or
-- just create new gift". Until now a link's key was stored only as a hash
-- (MESITA-3292), so it showed once.
--
--   wallet_gifts.token_sealed  the link's key, sealed by the EF (AES-GCM, key
--                              derived from the project's service-role secret;
--                              a copy of the database alone cannot open it).
--                              Null on links sent before this migration: those
--                              can only be taken back.
--   wallet_send_credit         takes p_token_sealed (default null, so the EF
--                              still deployed keeps working until it
--                              redeploys).
-- The hash stays the only thing a claim checks.
--
-- SHORT LINKS (same issue; Pato: "random 6 chars alphanumeric … just check
-- before that it doesn't exists yet … the link must only be
-- mesita.ai/g/abcdef"). A new key is 6 characters [A-Za-z0-9], hashed into
-- token_hash as before (22-character keys keep working):
--   wallet_send_credit         refuses a key whose hash any row ever had
--                              (code_taken); the EF draws again.
--   wallet_gift_link_misses    one row per wrong key looked up, per bucket
--                              ('c:<consumer>' for a signed-in guest,
--                              'preview' for the public preview).
--   wallet_gift_link_guard     under the bucket's cap? / record a miss.

-- ── 1. The sealed key ────────────────────────────────────────────────────────
alter table public.wallet_gifts
  add column if not exists token_sealed text;

comment on column public.wallet_gifts.token_sealed is
  'MESITA-4390: the link''s key sealed by the EF (AES-GCM, HKDF of the service-role secret), so consumer-web-get-gift-link can show an open gift''s link to its sender again. Null before MESITA-4390. Claims check token_hash only.';

-- ── 2. Sending carries it ────────────────────────────────────────────────────
drop function if exists public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text);

create or replace function public.wallet_send_credit(
  p_sender_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_token_hash text, p_max_open integer default 10,
  p_code_hash text default null, p_token_sealed text default null)
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

  -- A short key is drawn at random: one already used by any gift, open or
  -- closed, is never handed out again (MESITA-4390).
  if exists (select 1 from public.wallet_gifts where token_hash = p_token_hash) then
    return jsonb_build_object('ok', false, 'code', 'code_taken');
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

  insert into public.wallet_gifts (sender_id, place_id, amount_cents, currency, livemode, token_hash, code_hash, token_sealed, request_id)
  values (p_sender_id, p_place_id, p_amount_cents, p_currency, p_livemode, p_token_hash, p_code_hash, p_token_sealed, p_request_id)
  returning id, created_at into v_id, v_at;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, gift_id, livemode, available_at)
  values (p_sender_id, p_place_id, 'gift_out', -p_amount_cents, p_currency, v_id, p_livemode, now());

  return jsonb_build_object('ok', true, 'outcome', 'sent', 'gift_id', v_id, 'status', 'open',
    'amount_cents', p_amount_cents, 'currency', p_currency, 'created_at', v_at);
end;
$function$;

revoke all on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text, text) to service_role;

comment on function public.wallet_send_credit(uuid, uuid, integer, text, boolean, uuid, text, integer, text, text) is
  'MESITA-3292 Wallet: a guest sends spendable credit at one place as a one-time link. Under wallet_lock: a replayed request_id (same place, amount, livemode) answers already_sent; any other use answers taken; a key hash any gift ever had answers code_taken (MESITA-4390, the EF draws a new short key); more than p_max_open open links at the place answers too_many_open; more than spendable answers insufficient; otherwise one open wallet_gifts row (token_sealed: the key sealed for its sender, MESITA-4390) and one gift_out entry. Service role only.';

-- ── 3. Wrong keys are capped ─────────────────────────────────────────────────
create table if not exists public.wallet_gift_link_misses (
  id bigint generated always as identity primary key,
  bucket text not null,
  tried_at timestamptz not null default now()
);

create index if not exists wallet_gift_link_misses_bucket_idx on public.wallet_gift_link_misses (bucket, tried_at desc);

alter table public.wallet_gift_link_misses enable row level security;
revoke all on table public.wallet_gift_link_misses from public, anon, authenticated;
grant all on table public.wallet_gift_link_misses to service_role;

comment on table public.wallet_gift_link_misses is
  'MESITA-4390 Wallet: one row per gift-link key that matched no gift, by bucket (c:<consumer id> for a signed-in look or claim, preview for the public link preview). wallet_gift_link_guard counts the last hour so a 6-character key cannot be guessed. EF-only.';

-- p_miss false: is the bucket under p_max misses in the last hour?
-- p_miss true: record one miss (and drop the bucket's rows older than a day).
-- The bucket's advisory lock serialises its tries.
create or replace function public.wallet_gift_link_guard(p_bucket text, p_max integer, p_miss boolean default false)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_misses integer;
begin
  if p_bucket is null or p_max is null then
    raise exception 'wallet_gift_link_guard: bucket and max are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gift-link:' || p_bucket, 0));
  if p_miss then
    insert into public.wallet_gift_link_misses (bucket) values (p_bucket);
    delete from public.wallet_gift_link_misses where bucket = p_bucket and tried_at < now() - interval '1 day';
    return true;
  end if;
  select count(*)::integer into v_misses from public.wallet_gift_link_misses
   where bucket = p_bucket and tried_at > now() - interval '1 hour';
  return v_misses < p_max;
end;
$function$;

revoke all on function public.wallet_gift_link_guard(text, integer, boolean) from public, anon, authenticated;
grant execute on function public.wallet_gift_link_guard(text, integer, boolean) to service_role;

comment on function public.wallet_gift_link_guard(text, integer, boolean) is
  'MESITA-4390 Wallet: the wrong-key cap for short gift links. p_miss false answers whether p_bucket had fewer than p_max misses in the last hour; p_miss true records one. Service role only.';
