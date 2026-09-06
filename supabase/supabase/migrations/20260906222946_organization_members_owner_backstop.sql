-- organization_members ≥1-owner backstop (MESITA-1550).
--
-- project_members_one_owner_per_project (20260805190000) is a partial unique
-- index — it enforces AT-MOST-ONE owner and cannot express this invariant,
-- because organizations allow SEVERAL owners (organization_members' own
-- comment). What this needs is the opposite shape: AT-LEAST-ONE owner
-- remains after any delete or role-change on the LAST owner row.
--
-- The place-level equivalent (_shared/place-ownership.ts::isLastOwnerOfPlace)
-- is an application-level count-then-act check — racy under two concurrent
-- removals (both read count=2, both proceed, the org ends with zero owners).
-- This is a real constraint trigger instead: the EFs attempt the delete/
-- update directly and catch the exception, closing that race at the only
-- layer that can actually close it.
--
-- DEFERRABLE INITIALLY DEFERRED so a same-transaction ownership move (demote
-- A, promote B, both statements in one EF call) can pass through zero-owners
-- mid-transaction and still commit — the check only runs once, at commit.

create or replace function public.organization_members_check_owner_remains()
returns trigger as $$
declare
  remaining int;
begin
  select count(*) into remaining
  from public.organization_members
  where organization_id = old.organization_id
    and role = 'owner'
    and id <> old.id;
  if remaining = 0 then
    raise exception 'organization must keep at least one owner'
      using errcode = 'P0001', hint = 'last_owner';
  end if;
  return old;
end;
$$ language plpgsql;

comment on function public.organization_members_check_owner_remains() is
  'Fires only on a row that WAS an owner (delete, or an update off role=owner) — see the trigger''s WHEN clause. Raises hint=last_owner, which business-web-remove-org-member and business-web-update-org-member-role catch and translate to the same machine code place-level EFs already use.';

create constraint trigger organization_members_owner_backstop
  after delete or update of role on public.organization_members
  deferrable initially deferred
  for each row
  when (old.role = 'owner')
  execute function public.organization_members_check_owner_remains();

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'organization_members_owner_backstop'
      and tgrelid = 'public.organization_members'::regclass
  ) then
    raise exception 'organization_members_owner_backstop trigger missing after migration';
  end if;
end $$;

notify pgrst, 'reload schema';
