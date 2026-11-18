-- MESITA-4326 — a signed-out profile open counts as a view, with no person.
--
-- Pato, 2026-11-18: "anonymous users must not be created in the database at
-- all … the only thing anonymous must act on the platform is views, profile
-- views"; asked whether to count signed-out views as anonymous totals: "Yes,
-- counts only".
--
-- A visitor has no auth.users row and no consumers row (anonymous sign-ins
-- stay off). consumer-web-track-activity writes one place_events row with no
-- consumer for each signed-out open. The counters (Business Views' total and
-- chart, the Stats box) count it; the views log, the Social feed and the
-- person card join consumers and so never show it.

alter table public.place_events alter column consumer_id drop not null;

alter table public.place_events
  add constraint place_events_anonymous_view_only
  check (consumer_id is not null or kind = 'viewed');

comment on column public.place_events.consumer_id is
  'MESITA-4326: null = a signed-out visitor''s view (counted, never named). Only a viewed row may be null.';

-- Business Views' total, chart and log read this. A row with no consumer is
-- a signed-out view: kept (it counts); place_views_log still joins consumers,
-- so the log never lists it.
create or replace function public.place_views_events(p_place_id uuid)
returns table (consumer_id uuid, kind text, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at
    from public.place_events e
    left join public.consumers c on c.id = e.consumer_id
   where e.place_id = p_place_id
     and (e.consumer_id is null or c.deleted_at is null)
$$;

comment on function public.place_views_events(uuid) is
  'MESITA-3219, MESITA-4326: what counts on Business Views'' chart and log. Every row of place_events, no closed account; a signed-out view (no consumer) counts. service_role only.';

create or replace function public.place_view_counts(p_place_ids uuid[])
returns table (place_id uuid, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.place_id, count(*)::bigint
    from public.place_events e
    left join public.consumers c on c.id = e.consumer_id
   where e.place_id = any(p_place_ids)
     and e.kind = 'viewed'
     and (e.consumer_id is null or c.deleted_at is null)
   group by e.place_id
$$;

comment on function public.place_view_counts(uuid[]) is
  'MESITA-3422, MESITA-4326: Mesita Views per place, every open (place_events), no closed account; signed-out opens count. The Stats box and admin Single Place read it. service_role only.';

revoke execute on function public.place_view_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.place_view_counts(uuid[]) to service_role;
