-- MESITA-3060 — Me › Instagram's Sync, and one scrape budget per account.
--
-- Sync re-reads the connected handle's followers and photo (an Apify scrape,
-- paid per run). Two service-role functions, both called only by
-- consumer-web-lookup-instagram:
--
--   consumer_instagram_claim_scrape(id, kind, cooldown_s, daily_max)
--     Claims one scrape before it runs, under the row lock, so two tabs or a
--     double tap cannot both pay. `kind` 'sync' must wait `cooldown_s` since
--     the last sync attempt; every kind ('sync' and 'connect') counts toward
--     `daily_max` per UTC day. Every attempt counts, failed scrapes included
--     (Apify bills started runs). Returns jsonb:
--       { status: 'ok', remaining, limit }
--       { status: 'slow_down', retry_after_s, limit }
--       { status: 'daily_limit', remaining: 0, resets_at, limit }
--       { status: 'not_found' }            -- no such live account
--
--   consumer_instagram_sync(id, handle, followers)
--     Writes the scraped count and stamps instagram_synced_at, only while the
--     account still holds `handle` and is not deleted (a Change account or
--     Disconnect in another tab during the scrape wins). Never touches
--     instagram_verified_at: the DM claim's dm_status reads it as proof
--     (MESITA-2575). Returns whether a row was written.
--
-- Reset one guest's budget by hand:
--   update consumers set instagram_sync_count = 0, instagram_sync_attempted_at = null where id = '<id>';

alter table public.consumers
  add column if not exists instagram_synced_at          timestamptz,
  add column if not exists instagram_sync_attempted_at  timestamptz,
  add column if not exists instagram_sync_day           date,
  add column if not exists instagram_sync_count         integer not null default 0
    check (instagram_sync_count >= 0);

comment on column public.consumers.instagram_synced_at is
  'Last successful Me › Instagram Sync (MESITA-3060). The card shows the later of this and instagram_verified_at.';
comment on column public.consumers.instagram_sync_attempted_at is
  'Last Sync attempt, the 60 s cooldown clock (MESITA-3060). Written only by consumer_instagram_claim_scrape.';
comment on column public.consumers.instagram_sync_day is
  'UTC day instagram_sync_count belongs to (MESITA-3060).';
comment on column public.consumers.instagram_sync_count is
  'Instagram scrapes (connect + sync) on instagram_sync_day (MESITA-3060).';

create or replace function public.consumer_instagram_claim_scrape(
  p_consumer_id uuid,
  p_kind text,
  p_cooldown_s integer,
  p_daily_max integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date := (now() at time zone 'utc')::date;
  v_count integer;
  v_wait integer;
begin
  select instagram_sync_attempted_at, instagram_sync_day, instagram_sync_count
    into r
    from public.consumers
   where id = p_consumer_id and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_count := case when r.instagram_sync_day = v_today then r.instagram_sync_count else 0 end;

  if p_kind = 'sync' and r.instagram_sync_attempted_at is not null
     and r.instagram_sync_attempted_at > now() - make_interval(secs => p_cooldown_s) then
    v_wait := ceil(extract(epoch from (
      r.instagram_sync_attempted_at + make_interval(secs => p_cooldown_s) - now())))::integer;
    return jsonb_build_object('status', 'slow_down', 'retry_after_s', greatest(v_wait, 1),
                              'limit', p_daily_max);
  end if;

  if v_count >= p_daily_max then
    return jsonb_build_object(
      'status', 'daily_limit', 'remaining', 0, 'limit', p_daily_max,
      'resets_at', ((v_today + 1)::timestamp at time zone 'utc'));
  end if;

  update public.consumers
     set instagram_sync_day = v_today,
         instagram_sync_count = v_count + 1,
         instagram_sync_attempted_at = case when p_kind = 'sync' then now()
                                            else instagram_sync_attempted_at end
   where id = p_consumer_id;

  return jsonb_build_object('status', 'ok', 'remaining', p_daily_max - v_count - 1,
                            'limit', p_daily_max);
end;
$$;

create or replace function public.consumer_instagram_sync(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consumers
     set instagram_followers_count = p_followers,
         instagram_synced_at = now()
   where id = p_consumer_id
     and instagram_handle = p_handle
     and deleted_at is null;
  return found;
end;
$$;

revoke execute on function public.consumer_instagram_claim_scrape(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consumer_instagram_claim_scrape(uuid, text, integer, integer)
  to service_role;
revoke execute on function public.consumer_instagram_sync(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.consumer_instagram_sync(uuid, text, integer)
  to service_role;
