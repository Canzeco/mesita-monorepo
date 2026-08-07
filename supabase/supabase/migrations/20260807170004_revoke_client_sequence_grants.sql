-- MESITA-942: sequences should not be usable by PostgREST client roles.
-- place_creation_attempts is EF-only; its identity sequence leaked USAGE
-- to anon/authenticated via default privileges.

do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass as seq
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S' and n.nspname = 'public'
  loop
    execute format('revoke all on sequence %s from anon, authenticated', r.seq);
    execute format('grant all on sequence %s to service_role', r.seq);
  end loop;
end $$;
