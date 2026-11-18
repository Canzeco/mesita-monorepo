-- MESITA-4310: the Story emulator needs no screenshot. Pato: "Build the
-- emulator. No screenshot required. Just tag the place."
--
-- A test story (source emulator) now carries no media. Its "delete" is this
-- column, written by consumer-web-emulate-story; the 3-hour re-check reads it
-- instead of fetching an image. Real Meta stories never write it.

alter table public.story_mentions add column deleted_at timestamptz;

comment on column public.story_mentions.deleted_at is
  'MESITA-4310: when the guest deleted this test story (consumer-web-emulate-story delete). The re-check counts a media-less emulator story as gone once set. Null for every Meta story.';
