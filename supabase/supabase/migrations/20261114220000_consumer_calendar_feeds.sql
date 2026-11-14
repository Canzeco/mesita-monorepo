-- MESITA-3954 CALENDAR FEED (Pato, 2026-11-14: "enable Google Calendar or
-- other Calendar in order to update your calendar based on that
-- reservations").
--
-- One private iCal link per guest. Google, Apple and Outlook subscribe to it
-- and re-read it on their own schedule, so a new or cancelled table shows up
-- without the guest doing anything. The token is the only key: whoever holds
-- the link reads that guest's upcoming tables, so it is long, random, and
-- the guest can make a new one (the old link stops working).
--
-- Written by consumer-web-get-calendar-link (get-or-create, reset); read by
-- consumer-web-get-calendar-feed (by token). Service role only.

create table if not exists public.consumer_calendar_feeds (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  created_at timestamptz not null default now()
);
alter table public.consumer_calendar_feeds enable row level security;
revoke all on table public.consumer_calendar_feeds from anon, authenticated;
comment on table public.consumer_calendar_feeds is
  'MESITA-3954: each guest''s private calendar feed token (Me › Integrations › Calendar). The feed EF reads upcoming reservation_tickets by this token. Service role only.';
