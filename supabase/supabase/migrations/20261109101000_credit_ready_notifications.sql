-- MESITA-3293 — tell guests when Pending credit is ready.
--
-- A wallet entry is Pending until available_at (MESITA-3302). Nothing
-- happens at that moment, so the settle cron (supabase-cron-settle-wallet,
-- every 5 minutes) calls wallet_notify_ready_credit once a tick and the guest
-- gets one Me › Notifications row per place and ready time:
-- "MX$500 is ready to spend" under the place's name and photo.
--
--   consumer_notifications.kind   + 'credit_ready'
--   consumer_notifications_credit_ready_key
--                                 one row per payload->>'key'
--                                 (consumer · place · currency · mode · time),
--                                 so a second tick writes nothing.
--   wallet_notify_ready_credit    the writer; service role only.
--
-- Rules the writer keeps:
--   * only credit that was really Pending: a positive entry whose
--     available_at is more than a minute after it was written;
--   * only credit that turned ready inside the window (default 1 day), so a
--     cron outage never floods old news and the first run stays small;
--   * only when the guest's Available balance at that place is above zero
--     now (a voucher refunded before it was ready tells nothing), and the
--     amount is the smaller of the two.
--
-- Additive: a wider kind check, a partial unique index and a new function.

-- ── 1. The kind ──────────────────────────────────────────────────────────────
alter table public.consumer_notifications
  drop constraint if exists consumer_notifications_kind_check;

alter table public.consumer_notifications
  add constraint consumer_notifications_kind_check
  check (kind in ('reservation', 'booking', 'credit_ready'));

create unique index if not exists consumer_notifications_credit_ready_key
  on public.consumer_notifications ((payload ->> 'key'))
  where kind = 'credit_ready';

comment on table public.consumer_notifications is
  'Me › Notifications. Kinds: reservation | booking (a reservation update; payload place_name / place_photo_url, MESITA-942, MESITA-2091) and credit_ready (Pending credit turned Available; payload key, place_id, place_name, place_photo_url, amount_cents, currency, ready_at; written by wallet_notify_ready_credit, MESITA-3293). EF-only (RLS, no policies). Client roles: no privileges.';

-- ── 2. The writer ────────────────────────────────────────────────────────────
create or replace function public.wallet_notify_ready_credit(
  p_livemode boolean,
  p_now timestamptz default now(),
  p_window interval default interval '1 day')
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  with ready as (
    select e.consumer_id, e.place_id, e.currency, e.available_at,
           sum(e.amount_cents)::integer as amount_cents
      from public.wallet_entries e
     where e.livemode = p_livemode
       and e.consumer_id is not null
       and e.amount_cents > 0
       and e.available_at <= p_now
       and e.available_at > p_now - p_window
       and e.available_at > e.created_at + interval '1 minute'
     group by e.consumer_id, e.place_id, e.currency, e.available_at
  ),
  sized as (
    select r.*,
           least(r.amount_cents, (
             select coalesce(sum(b.amount_cents), 0)::integer
               from public.wallet_entries b
              where b.consumer_id = r.consumer_id
                and b.place_id = r.place_id
                and b.currency = r.currency
                and b.livemode = p_livemode
                and b.available_at <= p_now)) as shown_cents
      from ready r
  ),
  ins as (
    insert into public.consumer_notifications (consumer_id, kind, payload)
    select s.consumer_id, 'credit_ready',
           jsonb_strip_nulls(jsonb_build_object(
             'key', concat_ws('|', s.consumer_id, s.place_id, s.currency,
                              case when p_livemode then 'live' else 'test' end,
                              extract(epoch from s.available_at)::bigint),
             'place_id', s.place_id,
             'place_name', nullif(nullif(btrim(pp.name), ''), '(unnamed)'),
             'place_photo_url', nullif(pp.photos[1], ''),
             'amount_cents', s.shown_cents,
             'currency', s.currency,
             'ready_at', s.available_at))
      from sized s
      join public.consumers c on c.id = s.consumer_id
      left join public.place_profiles pp on pp.id = s.place_id
     where s.shown_cents > 0
    on conflict ((payload ->> 'key')) where kind = 'credit_ready' do nothing
    returning 1
  )
  select count(*)::integer into v_count from ins;
  return v_count;
end;
$function$;

revoke all on function public.wallet_notify_ready_credit(boolean, timestamptz, interval) from public, anon, authenticated;
grant execute on function public.wallet_notify_ready_credit(boolean, timestamptz, interval) to service_role;

comment on function public.wallet_notify_ready_credit(boolean, timestamptz, interval) is
  'MESITA-3293: one consumer_notifications credit_ready row per (guest, place, currency, ready time) for positive entries that were Pending and turned Available inside p_window, sized to the smaller of that credit and the place''s Available balance now, never twice (consumer_notifications_credit_ready_key). Called once a tick by supabase-cron-settle-wallet. Service role only.';
