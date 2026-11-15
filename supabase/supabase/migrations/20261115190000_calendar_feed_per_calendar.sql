-- MESITA-4041 ONE LINK PER CALENDAR (Pato, 2026-11-15: "make sure the
-- calendar integration is working and actually put toggles or something …
-- to understand that calendar is connected").
--
-- consumer_calendar_feeds held one link per guest (MESITA-3954). Now each
-- calendar — google · apple · outlook — has its own, so Me › Calendar can say
-- which calendar is connected and switch exactly that one off:
--   last_read_at  stamped by consumer-web-get-calendar-feed on every read; a
--                 calendar that has read its link at least once is connected
--   off           the guest switched it off: the feed serves an empty
--                 calendar, so Mesita's tables leave it on its next sync
--
-- decision: the one existing link per guest becomes Google's — the only
-- calendar that has read a link (Google-Calendar-Importer, 2026-11-15).

alter table public.consumer_calendar_feeds
  add column if not exists calendar text not null default 'google',
  add column if not exists last_read_at timestamptz,
  add column if not exists off boolean not null default false;

alter table public.consumer_calendar_feeds
  alter column calendar drop default;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'consumer_calendar_feeds_calendar_check'
      and conrelid = 'public.consumer_calendar_feeds'::regclass
  ) then
    alter table public.consumer_calendar_feeds
      add constraint consumer_calendar_feeds_calendar_check
      check (calendar in ('google', 'apple', 'outlook'));
  end if;
end $$;

alter table public.consumer_calendar_feeds
  drop constraint if exists consumer_calendar_feeds_pkey;
alter table public.consumer_calendar_feeds
  add constraint consumer_calendar_feeds_pkey primary key (consumer_id, calendar);

comment on table public.consumer_calendar_feeds is
  'MESITA-3954 / MESITA-4041: one private calendar feed link per guest and calendar (google · apple · outlook), Me › Integrations › Calendar. The feed EF reads upcoming reservation_tickets by token, stamps last_read_at, and serves an empty calendar when off. Service role only.';
