-- MESITA-446 + MESITA-444
--
-- 1) Drop place_images_public_read SELECT on storage.objects.
--    Bucket stays public — known object URLs
--    (/storage/v1/object/public/place-images/…) keep working without a
--    listing-capable SELECT policy (advisor lint 0025).
--
-- 2) Revoke EXECUTE on is_super_admin / is_project_member from anon (+ PUBLIC).
--    Keep authenticated — place-images member/admin storage RLS policies call
--    these SECURITY DEFINER helpers (MESITA-315). Advisor WARN for authenticated
--    remains intentional; anon RPC must not.

drop policy if exists "place_images_public_read" on storage.objects;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_super_admin() from anon;
revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.is_project_member(uuid) from anon;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
