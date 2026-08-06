-- MESITA-940: rename leftover R2 index / constraint names after
-- businesses→accounts, business_invites→account_invites, units→projects.
-- Pure renames — no definition change. Safe under concurrent traffic.
--
-- Prefer ALTER TABLE … RENAME CONSTRAINT for constraint-backed names;
-- ALTER INDEX for standalone indexes. IF EXISTS keeps this idempotent
-- across environments that already renamed a subset.

-- account_invites (was business_invites)
alter index if exists public.business_invites_email_idx
  rename to account_invites_email_idx;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'business_invites_pkey'
      and conrelid = 'public.account_invites'::regclass
  ) then
    alter table public.account_invites rename constraint business_invites_pkey to account_invites_pkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'business_invites_token_key'
      and conrelid = 'public.account_invites'::regclass
  ) then
    alter table public.account_invites rename constraint business_invites_token_key to account_invites_token_key;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'business_invites_claimed_by_fkey'
      and conrelid = 'public.account_invites'::regclass
  ) then
    alter table public.account_invites
      rename constraint business_invites_claimed_by_fkey to account_invites_claimed_by_fkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'business_invites_created_by_fkey'
      and conrelid = 'public.account_invites'::regclass
  ) then
    alter table public.account_invites
      rename constraint business_invites_created_by_fkey to account_invites_created_by_fkey;
  end if;

  -- accounts (was businesses)
  if exists (
    select 1 from pg_constraint
    where conname = 'businesses_pkey'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts rename constraint businesses_pkey to accounts_pkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'businesses_id_fkey'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts rename constraint businesses_id_fkey to accounts_id_fkey;
  end if;

  -- projects (was units)
  if exists (
    select 1 from pg_constraint
    where conname = 'units_pkey' and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects rename constraint units_pkey to projects_pkey;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'units_slug_key' and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects rename constraint units_slug_key to projects_slug_key;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'units_place_fk' and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects rename constraint units_place_fk to projects_place_fk;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'units_monthly_promo_cap_legal_values'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      rename constraint units_monthly_promo_cap_legal_values to projects_monthly_promo_cap_legal_values;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'units_promo_rate_legal_values'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      rename constraint units_promo_rate_legal_values to projects_promo_rate_legal_values;
  end if;
  if exists (
    select 1 from pg_constraint
    where conname = 'units_reward_cap_cents_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      rename constraint units_reward_cap_cents_check to projects_reward_cap_cents_check;
  end if;
end $$;

alter index if exists public.units_status_idx
  rename to projects_status_idx;
alter index if exists public.units_adea_status_idx
  rename to projects_adea_status_idx;

alter index if exists public.project_members_business_idx
  rename to project_members_account_idx;
alter index if exists public.project_members_project_id_business_id_key
  rename to project_members_project_id_account_id_key;
