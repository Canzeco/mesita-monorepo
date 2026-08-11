-- MESITA-1030 — ticket-proofs: public bucket for task proof screenshots.
--
-- The Google review and Instagram story tasks now take a SCREENSHOT as the
-- proof (Pato: "the screenshot is the way to validate — just post whatever
-- screenshot and it's done"). Verification posture is unchanged from
-- MESITA-849: the guest's submission self-attests (`self_verified`), nothing
-- inspects the image — the screenshot is the audit artifact, stored on
-- tickets.story_screenshot_url / review_screenshot_url (columns that already
-- existed; check-web surfaces the story one to staff).
--
-- Path contract (enforced by RLS + the submit EFs' URL prefix check, same
-- shape as consumer-avatars):
--   {consumer_id}/{ticket_id}-{story|review}-{timestamp}.jpg
--
-- Client uploads as the signed-in JWT (house pattern per consumer-avatars),
-- then calls consumer-web-submit-story / -submit-review with the public URL.
-- Proofs are immutable: no update/delete policies on purpose — a replaced
-- screenshot is a NEW timestamped object, and the ticket row points at the
-- one that was submitted.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-proofs',
  'ticket-proofs',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read — proof URLs render straight from the public object URL
-- (consumer's own ticket screen + the staff check page).
drop policy if exists "ticket_proofs_public_read" on storage.objects;
create policy "ticket_proofs_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'ticket-proofs');

-- Caller may upload only under their own consumer id folder.
drop policy if exists "ticket_proofs_owner_insert" on storage.objects;
create policy "ticket_proofs_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ticket-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
