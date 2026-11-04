-- MESITA-3219 — Business Views keeps every view, like and share (Pato, 2026-11-03:
-- "Yes, record every visit").
--
-- place_activity and place_shares hold one row per guest × place × action, and a
-- repeat moves that row forward, so they cannot say what happened last week. They
-- stay as they are: Social, the saved list and the guest counts read them. This is
-- the history beside them, written by triggers so that no writer can forget it and
-- no Edge Function changes.
--
--   viewed   a new row per open; a reopen within 30 minutes is the same view, because
--            the place screen fires on every mount (a reload, a back press)
--   saved    a new row per like. An unlike removes that guest's likes of that place,
--            so the log never names a like they took back. A backfilled `quiet` save
--            is not a tap and writes nothing.
--   shared   a new row per share
--
-- No device point (MESITA-2946). EF-only: RLS on, no policies, client roles hold
-- nothing. admin_reset_database's dynamic wipe truncates it; a deleted account or
-- place takes its rows with it.

create table public.place_events (
  id bigint generated always as identity primary key,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  kind text not null check (kind in ('viewed', 'saved', 'shared')),
  created_at timestamptz not null default now()
);

comment on table public.place_events is
  'MESITA-3219: every view, like and share of a place, never overwritten. Written by triggers on place_activity and place_shares; Business Views'' chart and log read it. EF-only.';

create index place_events_place_idx on public.place_events (place_id, created_at desc);
create index place_events_guest_idx on public.place_events (consumer_id, place_id, kind, created_at desc);

alter table public.place_events enable row level security;
revoke all on table public.place_events from public, anon, authenticated;
grant all on table public.place_events to service_role;

-- What the old tables already know, so the log does not start empty. Repeats from
-- before this were never stored.
insert into public.place_events (consumer_id, place_id, kind, created_at)
select a.consumer_id, a.place_id, a.kind, a.created_at
  from public.place_activity a
 where a.kind in ('viewed', 'saved')
   and not a.quiet
union all
select s.consumer_id, s.place_id, 'shared', s.shared_at
  from public.place_shares s;

create function public.place_activity_to_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'saved' then
      delete from public.place_events e
       where e.consumer_id = old.consumer_id
         and e.place_id = old.place_id
         and e.kind = 'saved';
    end if;
    return null;
  end if;

  if new.quiet or new.kind not in ('viewed', 'saved') then
    return null;
  end if;

  if new.kind = 'saved' then
    -- A second "like" on a like already standing is not a new tap.
    if tg_op = 'UPDATE' and not old.quiet then
      return null;
    end if;
  else
    if tg_op = 'UPDATE' and new.created_at = old.created_at then
      return null;
    end if;
    if exists (
      select 1 from public.place_events e
       where e.consumer_id = new.consumer_id
         and e.place_id = new.place_id
         and e.kind = 'viewed'
         and e.created_at > new.created_at - interval '30 minutes'
    ) then
      return null;
    end if;
  end if;

  insert into public.place_events (consumer_id, place_id, kind, created_at)
  values (new.consumer_id, new.place_id, new.kind, new.created_at);
  return null;
end;
$$;

create function public.place_shares_to_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.place_events (consumer_id, place_id, kind, created_at)
  values (new.consumer_id, new.place_id, 'shared', new.shared_at);
  return null;
end;
$$;

create trigger place_activity_to_events
  after insert or update or delete on public.place_activity
  for each row execute function public.place_activity_to_events();

create trigger place_shares_to_events
  after insert or update on public.place_shares
  for each row execute function public.place_shares_to_events();

revoke execute on function public.place_activity_to_events() from public, anon, authenticated;
revoke execute on function public.place_shares_to_events() from public, anon, authenticated;

-- The chart and the log read the history now. Their signatures, and who is named
-- (place_views_log), do not change.
create or replace function public.place_views_events(p_place_id uuid)
returns table (consumer_id uuid, kind text, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at
    from public.place_events e
    join public.consumers c on c.id = e.consumer_id
   where e.place_id = p_place_id
     and c.deleted_at is null
$$;

comment on function public.place_views_events(uuid) is
  'MESITA-3219: what counts on Business Views'' chart and log. Every row of place_events, no closed account. service_role only.';

comment on function public.place_views_days(uuid, text, integer) is
  'MESITA-3219: Business Views'' chart. Every view, like and share per day in the place''s timezone. service_role only.';
