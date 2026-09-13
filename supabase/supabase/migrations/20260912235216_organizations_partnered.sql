-- Org-level Partner (MESITA-1798).
--
-- Stripe is one account per organization. Partner is the next org fact:
-- a binary switch, not derived from charges_enabled. Turning it on
-- joins every held place (plan=pro) and turns on the org Mesita Pay
-- package (organizations.mesita_pay_enabled already exists; this is
-- the missing writer, shipped in business-web-set-org-partnership).
-- A place in the public pool has no organization and is therefore
-- not a partner through this bit.
--
-- Default false: an org with Stripe Ready is not yet a Partner until
-- the owner flips the switch.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME matches the stamped version
-- 20260912235216 rather than writing to schema_migrations by hand.

alter table public.organizations
  add column if not exists partnered boolean not null default false;

comment on column public.organizations.partnered is
  'This organization is a Mesita Partner. One switch on the Organization screen; every place it holds joins (plan=pro). Independent of Stripe Ready — Stripe is the lock on the switch, not the fact.';
