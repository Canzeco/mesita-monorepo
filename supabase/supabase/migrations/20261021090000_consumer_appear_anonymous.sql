-- MESITA-2590: a member can choose to appear as "A member" in Social.
--
-- Pato, 2026-10-21: Social shows the full @handle now (reversing MESITA-2522),
-- and Settings › Social gets "Show my name in Social" (on by default). Off
-- means the member appears anonymously, the way a member without Instagram
-- already does (MESITA-2580): never hidden, just unnamed.
--
-- One rule decides it: place_activity_visible names a member only with a
-- verified Instagram, not deleted, and not appear_anonymous. The feed
-- (anonymous rows), the line under a place's title (named only) and the
-- person card's liked list (named only) all read that one rule.
--
-- Live data at write time: 1 consumer; the default keeps everyone as today.

alter table public.consumers
  add column if not exists appear_anonymous boolean not null default false;

comment on column public.consumers.appear_anonymous is
  'MESITA-2590: the member chose to appear as "A member" in Social (Settings › Social › Show my name in Social, off). Only consumer-web-update-profile writes it; place_activity_visible reads it.';

create or replace function public.place_activity_visible(c public.consumers)
returns boolean
language sql
immutable
as $$
  select c.instagram_handle is not null
     and c.instagram_verified_at is not null
     and c.deleted_at is null
     and not c.appear_anonymous
$$;
