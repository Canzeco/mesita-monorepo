-- MESITA-3092 — Premier (b), cut-over: one `ready` subscription per place,
-- and the backup line's `failed` status retires (a declined renewal ends the
-- pledge instead). Runs after 20261102002000, which every writer now uses.

do $$
begin
  if exists (select 1 from public.place_backings
              where status = 'ready' group by place_id having count(*) > 1) then
    raise exception 'premier_one_ready: a place has two ready pledges; end all but one first';
  end if;
end
$$;

update public.place_backings
   set status = 'ended', ended_reason = 'declined', ended_at = coalesce(ended_at, now()), updated_at = now()
 where status = 'failed';
update public.place_backings
   set ended_reason = 'left'
 where status = 'ended' and ended_reason is null;

alter table public.place_backings drop constraint if exists place_backings_status_check;
alter table public.place_backings
  add constraint place_backings_status_check check (status in ('open', 'ready', 'ended'));
alter table public.place_backings
  add constraint place_backings_ended_reason_set check ((status = 'ended') = (ended_reason is not null));

drop index if exists public.place_backings_one_live;
create unique index place_backings_one_live
  on public.place_backings (place_id, consumer_id)
  where status in ('open', 'ready') and consumer_id is not null;

create unique index place_backings_one_ready
  on public.place_backings (place_id)
  where status = 'ready';

comment on table public.place_backings is
  'MESITA-2995 / MESITA-3092 Premier pledges. open = a Checkout not finished; ready = the place''s one Paid subscription (card saved; at most one per place); ended = with ended_reason. Payer = the consumer of the place''s ready pledge. Becomes ready only through premier_make_payer. EF-only (RLS, no policies; client privileges revoked).';
