-- MESITA-2552 — no Public profile switch: connecting Instagram means you show
-- in Social, always.
--
-- Pato, 2026-10-21: "for the moment there are no public and private. if you
-- connect your … instagram, is because you want to be seen. there is no other
-- reason." The handle stays hidden on every card (three letters and a rough
-- follower count, MESITA-2522), so nobody is sent off to Instagram.
--
-- So the switch (consumers.show_activity, MESITA-2442; labelled "Public
-- profile" by MESITA-2547) goes. The visibility rule loses it first, then the
-- column is dropped. Who appears: a verified Instagram handle, not deleted.

create or replace function public.place_activity_visible(c public.consumers)
returns boolean
language sql
immutable
as $$
  select c.instagram_handle is not null
     and c.instagram_verified_at is not null
     and c.deleted_at is null
$$;

alter table public.consumers
  drop column if exists show_activity;
