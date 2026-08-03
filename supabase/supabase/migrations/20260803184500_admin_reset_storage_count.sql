-- Reset DB — let the purge report what's left.
--
-- 20260803180758 made the reset wipe every table and drain the buckets, but a
-- drain of thousands of objects is longer than the operator's request budget
-- (the admin app's server action, then the EF's wall clock). So the purge now
-- runs to a time budget and the caller resumes until it's done — which needs
-- an answer to "how many are still there?" that doesn't cost a full listing.
--
-- Same lockdown as admin_reset_storage_paths: storage.objects is not reachable
-- over PostgREST and this is the same back door, so service_role only.

create or replace function public.admin_reset_storage_count(
  p_keep_buckets text[] default '{}'
)
returns bigint
language sql
security definer
set search_path to 'pg_catalog', 'storage', 'public'
as $function$
  select count(*)::bigint
    from storage.objects o
   where o.bucket_id <> all (coalesce(p_keep_buckets, '{}'::text[]));
$function$;

revoke execute on function public.admin_reset_storage_count(text[])
  from public, anon, authenticated;
grant execute on function public.admin_reset_storage_count(text[])
  to service_role;

notify pgrst, 'reload schema';
