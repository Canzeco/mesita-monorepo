-- Audit Wave 2 attics + the live-only CFDI ledger hole.
-- CFDI columns exist on production and in place-doc.ts but no repo migration
-- added them, so local replay 42703'd Wave 0 pins. Add them here (IF NOT EXISTS).
-- They stay secrets: Wave 0 already revoked table SELECT on projects, so a
-- later ADD COLUMN does not grant anon SELECT on the new names.

alter table public.projects
  add column if not exists cfdi_rfc text,
  add column if not exists cfdi_razon_social text,
  add column if not exists cfdi_cp text;

alter table public.projects drop constraint if exists projects_cfdi_rfc_shape;
alter table public.projects
  add constraint projects_cfdi_rfc_shape
  check (cfdi_rfc is null or cfdi_rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$');

alter table public.projects drop constraint if exists projects_cfdi_razon_social_len;
alter table public.projects
  add constraint projects_cfdi_razon_social_len
  check (
    cfdi_razon_social is null
    or (length(cfdi_razon_social) >= 1 and length(cfdi_razon_social) <= 200)
  );

alter table public.projects drop constraint if exists projects_cfdi_cp_shape;
alter table public.projects
  add constraint projects_cfdi_cp_shape
  check (cfdi_cp is null or cfdi_cp ~ '^[0-9]{5}$');

comment on column public.projects.cfdi_rfc is
  'Mexican RFC. Secret — no client SELECT. Written via business EF.';
comment on column public.projects.cfdi_razon_social is
  'CFDI legal name. Secret — no client SELECT.';
comment on column public.projects.cfdi_cp is
  'CFDI postal code (5 digits). Secret — no client SELECT.';

-- Wave 0 revoked table SELECT on projects. New columns still get an explicit
-- column REVOKE so a later GRANT SELECT (table) cannot resurrect them.
revoke select (cfdi_rfc, cfdi_razon_social, cfdi_cp)
    on table public.projects
  from anon, authenticated;

-- Guest compensation was never a product. Types only, no app writers.
delete from public.admin_reset_preserve
 where table_name in ('guest_make_goods', 'refund_requests');
drop table if exists public.guest_make_goods;
drop table if exists public.refund_requests;
