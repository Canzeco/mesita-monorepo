-- Exactly one owner per place (MESITA-919). Ownership is transferable via
-- business-web-update-member-role (promote demotes the previous owner to
-- editor). Collapse any multi-owner residue before the unique index.

with ranked as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc nulls last, id asc
    ) as rn
  from public.project_members
  where role = 'owner'
)
update public.project_members pm
set role = 'editor'
from ranked r
where pm.id = r.id
  and r.rn > 1;

create unique index if not exists project_members_one_owner_per_project
  on public.project_members (project_id)
  where role = 'owner';

comment on index public.project_members_one_owner_per_project is
  'MESITA-919: at most one project_members.role=owner per place; transfer by promoting another member.';
