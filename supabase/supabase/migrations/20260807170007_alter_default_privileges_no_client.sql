-- MESITA-942: stop Postgres default grants from re-arming anon/authenticated
-- on future public tables created by the migration role.

alter default privileges in schema public
  revoke all on tables from anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant all on sequences to service_role;
