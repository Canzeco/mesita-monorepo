-- One RFC is one organization (MESITA-1880).
--
-- The table comment has said "one organization = one RFC = one merchant"
-- since 20260905222953 and nothing enforced it: `rfc` was plain nullable
-- text, no shape, no normalization, no uniqueness. Two organizations could
-- carry the same tax ID, onboard two PERMANENT Stripe connected accounts for
-- one legal person, and split a guest's credits across two balances. Stripe
-- is not the backstop — it does not dedupe company.tax_id across connected
-- accounts and it has no account merge, so the lock has to be here.
--
-- FREE MOMENT: 2 organizations exist, 0 with an RFC. Nothing to backfill,
-- nothing to de-duplicate. The price of this migration rises with every
-- organization onboarded, exactly like the Express controller pivot
-- (MESITA-1532) did with every connected account.
--
-- `rfc` STAYS NULLABLE. The column comment's promise is that a tax ID is
-- required before an organization can be PAID, not before it exists, so the
-- index is partial and many NULLs stay legal.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME matches the stamped version
-- 20260915193826 rather than writing to schema_migrations by hand.

-- 1. Normalize before locking. Uniqueness over un-normalized text is fake
--    uniqueness: 'mesita010101abc' and 'MESITA010101ABC ' are two rows to
--    Postgres and one merchant to the SAT. A no-op today (0 rows), written
--    anyway so the index can never be applied to unnormalized data.
update public.organizations
   set rfc = upper(btrim(rfc))
 where rfc is not null
   and rfc is distinct from upper(btrim(rfc));

-- 2. Whitespace-only is "no RFC", not an RFC. Must run before the CHECK.
update public.organizations
   set rfc = null
 where rfc is not null
   and btrim(rfc) = '';

-- 3. THE SHAPE. Same regex the dropped places_cfdi_rfc_shape used and the
--    same one _shared/org-rfc.ts states in TypeScript — the twins are pinned
--    to each other by org-rfc.test.ts. Persona moral 12, persona física 13.
alter table public.organizations
  drop constraint if exists organizations_rfc_shape;

alter table public.organizations
  add constraint organizations_rfc_shape
  check (rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$');

-- 4. THE LOCK. Partial so NULLs stay unconstrained. This index, not the EF
--    check, is the guarantee: two concurrent creates both read "no twin" and
--    both insert, and only the index refuses the loser.
create unique index if not exists organizations_rfc_unique
  on public.organizations (rfc)
  where rfc is not null;

comment on column public.organizations.rfc is
  'Mexican tax ID. Nullable while ownership verification is out of scope; required before an organization can be paid. UNIQUE among non-null values (organizations_rfc_unique) and shape-checked (organizations_rfc_shape): one organization = one RFC = one merchant, because a duplicate becomes two permanent Stripe connected accounts Stripe cannot merge. Stored normalized (upper/trimmed) by business-web-create-organization and business-web-update-organization, which share _shared/org-rfc.ts with the Connect prefill.';
