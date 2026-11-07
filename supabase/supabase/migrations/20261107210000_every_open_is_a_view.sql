-- MESITA-3392 — every open of a place is one view (Pato, 2026-11-07: "every click
-- on your profile is one view, it doesn't matter is fomeone clicked 5 times in the
-- same minute").
--
-- MESITA-3219 merged a reopen within 30 minutes into the view before it. That merge
-- is gone: each `viewed` that moves place_activity.created_at forward writes a new
-- place_events row. Opens merged before this migration were never stored. Likes
-- and shares do not change.

create or replace function public.place_activity_to_events()
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
  elsif tg_op = 'UPDATE' and new.created_at = old.created_at then
    -- An update that is not an open (the same timestamp) is not a view.
    return null;
  end if;

  insert into public.place_events (consumer_id, place_id, kind, created_at)
  values (new.consumer_id, new.place_id, new.kind, new.created_at);
  return null;
end;
$$;

revoke execute on function public.place_activity_to_events() from public, anon, authenticated;

comment on table public.place_events is
  'MESITA-3219, MESITA-3392: every view (each open), like and share of a place, never overwritten. Written by triggers on place_activity and place_shares; Business Views'' numbers, chart and log read it. EF-only.';
