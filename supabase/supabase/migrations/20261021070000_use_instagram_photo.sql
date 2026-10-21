-- MESITA-2585 — the Instagram photo is opt-out.
--
-- Pato, 2026-10-21: "lets keep that as default but ask the user, they can
-- not activate that if they want. we only get the username and the
-- [followers]".
--
-- Verifying Instagram (bio code or DM) copies the profile photo into
-- consumer-avatars and makes it the guest's picture (MESITA-2578,
-- MESITA-2575). This flag is the guest's answer: on by default, switched on
-- Me › Instagram. Off → only the handle and the follower count are stored,
-- and an Instagram-copied picture is removed. An uploaded photo is never
-- touched either way. Written only through consumer-web-update-profile.

alter table public.consumers
  add column if not exists use_instagram_photo boolean not null default true;

comment on column public.consumers.use_instagram_photo is
  'MESITA-2585: may verifying Instagram set the guest''s picture from Instagram? Default true; off keeps only the handle and followers.';
