-- RESTORE public.profiles' security_invoker (regression from 20260908105013).
--
-- `create or replace view` RESETS reloptions. The Mesita Pay capability
-- migration replaced the view to append one derived column and silently
-- dropped `security_invoker = true` with it — so the view began running as its
-- OWNER and BYPASSING row-level security on places and place_profiles, which
-- means anon could read rows RLS exists to hide.
--
-- `schema_invariants` test 2 caught it on the fresh replay: "public.profiles
-- keeps security_invoker = true (without it anon reads rows RLS should hide)".
-- That test is the only reason this was a red CI job rather than a quiet hole.
-- It was live on the singleton for roughly ten minutes, on a catalog of one
-- place; the fix went out the moment the job reported.
--
-- 20260908105013 now carries `with (security_invoker = true)` inline AND
-- asserts it in its own post-flight, so a fresh replay never creates the
-- insecure view even for an instant. This migration is what repairs a database
-- that already ran the version without it — the two are not redundant, they
-- cover different starting states.
--
-- The rule, where the next person will hit it: never `create or replace view`
-- on profiles without restating the option.

alter view public.profiles set (security_invoker = true);

do $$
begin
  if not exists (
    select 1 from pg_class
     where oid = 'public.profiles'::regclass
       and reloptions @> array['security_invoker=true']
  ) then
    raise exception 'profiles.security_invoker is not set — RLS on the base tables is being bypassed';
  end if;
end $$;

notify pgrst, 'reload schema';
