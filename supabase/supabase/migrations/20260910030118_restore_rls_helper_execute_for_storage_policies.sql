-- Restores anon/authenticated EXECUTE on is_super_admin and is_place_member,
-- revoked one migration ago in error (MESITA-1721).
--
-- Both were read as leftovers of a retired RLS layer: public holds six policies
-- across fifty tables and all six are plain public-read USING clauses, so a
-- membership helper looked like dead weight from before the EF-only lockdown.
--
-- They are not retired. They back TWELVE live policies -- on storage.objects,
-- not on public. `place_images`, `menu_images` and `menu_pdfs` each gate
-- insert/update/delete on `is_place_member(...) or is_super_admin()`. The
-- policy expression is evaluated as the querying role, so revoking EXECUTE
-- stops a business operator uploading a place photo and an admin replacing a
-- menu PDF.
--
-- The audit that proposed the revoke queried pg_policy joined to pg_namespace
-- where nspname = 'public'. Storage policies live in the storage schema, so
-- every one of the twelve was invisible to it. Any future sweep of "unused"
-- database objects must scan pg_policy WITHOUT a schema filter.
--
-- MESITA-1725 proposed dropping both functions outright on the same evidence.
-- It must not: dropping them takes the twelve storage policies with them.

grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_place_member(uuid) to anon, authenticated;
