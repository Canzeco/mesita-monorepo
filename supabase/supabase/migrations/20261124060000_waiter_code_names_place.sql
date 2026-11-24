-- MESITA-4827 — the waiter scans and types one 6-digit code; no phone setup.
-- The code names its place by itself: lookup_hash is a keyed hash (the Edge
-- Function's service key), unique, so it is found without a place id. A code
-- set before this has none and is made again on Business › Offers.
-- A wrong code has no place yet: its try is kept with place_id null.
alter table public.place_codes add column if not exists lookup_hash text unique
  check (lookup_hash is null or lookup_hash ~ '^[0-9a-f]{64}$');
comment on column public.place_codes.lookup_hash is
  'MESITA-4827: keyed hash of the 6-digit waiter code, unique across places, so the code alone names its place. Null = a code from before, no longer usable.';
alter table public.place_charge_tries alter column place_id drop not null;
create index if not exists place_charge_tries_unplaced_idx
  on public.place_charge_tries (addr_hash, tried_at desc) where place_id is null;

-- The waiter types the bill between the scan and Send: the QR scanned last
-- lives five minutes after it rotates (60 seconds before).
create or replace function public.pay_guest_code_set(
  p_consumer_id uuid, p_token_hash text, p_short_hash text,
  p_ttl interval default interval '10 minutes', p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.pay_guest_lock(p_consumer_id);
  update public.pay_guest_codes
     set short_hash = md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text)
   where short_hash = p_short_hash and consumer_id <> p_consumer_id and expires_at <= p_now;
  begin
    insert into public.pay_guest_codes (consumer_id, token_hash, short_hash, expires_at, updated_at)
    values (p_consumer_id, p_token_hash, p_short_hash, p_now + p_ttl, p_now)
    on conflict (consumer_id) do update
      set prev_token_hash = case when pay_guest_codes.expires_at > p_now then pay_guest_codes.token_hash end,
          prev_until = case when pay_guest_codes.expires_at > p_now then p_now + interval '5 minutes' end,
          token_hash = excluded.token_hash, short_hash = excluded.short_hash,
          expires_at = excluded.expires_at, updated_at = p_now;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'collision');
  end;
  return jsonb_build_object('ok', true, 'expires_at', p_now + p_ttl);
end;
$function$;
revoke all on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_code_set(uuid, text, text, interval, timestamptz) to service_role;
