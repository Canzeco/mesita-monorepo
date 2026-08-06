-- MESITA-941: projects_view is the consumer browse surface (SELECT via ANON + RLS).
-- INSTEAD OF triggers (projects_view_insert/update/delete) are service_role-only,
-- so anon/authenticated DML grants only produce confusing 403s / ACL noise.
-- Keep SELECT for browse; revoke DML/TRUNCATE/TRIGGER from client roles.

revoke insert, update, delete, truncate, trigger, references
  on public.projects_view
  from anon, authenticated;

-- Explicit SELECT (idempotent if already granted).
grant select on public.projects_view to anon, authenticated;

comment on view public.projects_view is
  'SECURITY INVOKER browse view over projects+places. Client roles: SELECT only (RLS). DML goes through service_role INSTEAD OF triggers / EFs. MESITA-599 invoker invariant; MESITA-941 DML revoke.';
