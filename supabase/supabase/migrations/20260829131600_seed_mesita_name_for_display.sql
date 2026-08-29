-- Profile chrome reads mesita_name, not google_name. Rows created before
-- save-place seeded mesita_name still had NULL ⇒ generated name tracked Google
-- refreshes. Backfill copies the current Google label once; operators can
-- override after; Intaker still refreshes google_name only.

update public.places
set mesita_name = google_name
where nullif(btrim(mesita_name), '') is null
  and nullif(btrim(google_name), '') is not null;
