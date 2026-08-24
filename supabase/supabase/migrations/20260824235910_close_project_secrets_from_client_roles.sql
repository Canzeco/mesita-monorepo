-- Wave 0 Approach E — close PIN / twin PIN / CFDI on the publishable key.
-- Keep guest browse. Do not recreate public.profiles. Do not change RLS.
--
-- Postgres: table-level SELECT implies every column. A bare
--   REVOKE SELECT (check_pin) ON public.projects FROM anon
-- while table SELECT remains does nothing. Required pattern:
--   REVOKE SELECT ON TABLE … then GRANT SELECT (non-secret columns).
--
-- public.profiles is security_invoker=true and does not project the five
-- secrets. Invoker still needs SELECT on every projects column the view
-- reads (plan, rates, strikes, …). Table-REVOKE without the GRANT 42501s
-- consumer-web-list-places. Flipping invoker off reopens MESITA-599.

revoke select on table public.projects from anon, authenticated;

do $$
declare
  cols text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'projects'
    and c.column_name not in (
      'check_pin',
      'staff_pin',
      'cfdi_rfc',
      'cfdi_cp',
      'cfdi_razon_social'
    );

  if cols is null or cols = '' then
    raise exception
      'no grantable projects columns — refusing to leave anon with zero SELECT';
  end if;

  execute format(
    'grant select (%s) on table public.projects to anon, authenticated',
    cols
  );
end $$;

-- Leftover client grants. consumer_plans has no RLS policy that would
-- hide rows. consumers SELECT for anon never matches id = auth.uid().
revoke select on table public.consumer_plans from anon, authenticated;
revoke select on table public.consumers from anon;

-- Dead hard-delete helper. No DELETE trigger is bound to it.
drop function if exists public.profiles_delete();

-- postgres already revoked client default table grants (MESITA-942).
-- supabase_admin still grants ALL on new public tables to anon/authenticated.
alter default privileges for role supabase_admin in schema public
  revoke all on tables from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.projects', 'SELECT') then
    raise exception
      'anon still has table-level SELECT on public.projects — secrets leak';
  end if;
  if has_column_privilege('anon', 'public.projects', 'check_pin', 'SELECT')
     or has_column_privilege('anon', 'public.projects', 'staff_pin', 'SELECT')
     or has_column_privilege('anon', 'public.projects', 'cfdi_rfc', 'SELECT')
     or has_column_privilege('anon', 'public.projects', 'cfdi_cp', 'SELECT')
     or has_column_privilege('anon', 'public.projects', 'cfdi_razon_social', 'SELECT')
  then
    raise exception 'anon still has SELECT on a projects secret column';
  end if;
  if not has_column_privilege('anon', 'public.projects', 'plan', 'SELECT') then
    raise exception
      'anon lost SELECT on projects.plan — profiles browse will 42501';
  end if;
  if not has_table_privilege('anon', 'public.places', 'SELECT') then
    raise exception 'anon lost table SELECT on public.places — browse dies';
  end if;
  if not has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'anon lost SELECT on public.profiles — browse dies';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.profiles'::regclass
      and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'public.profiles lost security_invoker=true';
  end if;
  if not has_column_privilege('service_role', 'public.projects', 'check_pin', 'SELECT') then
    raise exception 'service_role lost SELECT on projects.check_pin';
  end if;
end $$;
