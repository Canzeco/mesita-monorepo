-- MESITA-1544 — pool claims get an admin review queue.
--
-- claim_place_into_org (MESITA-1537) keeps granting ownership instantly and
-- atomically — the funnel that migration built stays exactly as fast. This
-- only adds an audit trail: a claim starts unreviewed, and a super-admin
-- either clears it or reverses it (release_place_from_org). Nothing here
-- blocks or delays a claim.

alter table public.projects
  add column if not exists claim_reviewed_at timestamptz,
  add column if not exists claim_reviewed_by uuid
    references auth.users(id) on delete set null;

comment on column public.projects.claim_reviewed_at is
  'When a super-admin cleared this claim in the review queue (admin-web-decide-place-claim). NULL while organization_id/claimed_by are set means the claim is still unreviewed. Cleared back to NULL by release_place_from_org, which also nulls claimed_by/claimed_at.';
comment on column public.projects.claim_reviewed_by is
  'The super-admin (auth.users.id) who cleared the claim. NULL until reviewed.';

-- Queue hot path: unreviewed, currently-claimed places, newest claim first.
create index if not exists projects_unreviewed_claims_idx
  on public.projects (claimed_at desc)
  where organization_id is not null and claimed_by is not null and claim_reviewed_at is null;

-- release_place_from_org (20260906040000) drops a place back into the pool;
-- redefined only to also clear the two columns this migration adds, so the
-- NEXT claimer starts unreviewed rather than inheriting this tenure's flag.
create or replace function public.release_place_from_org(
  p_place_id uuid,
  p_organization_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_claimed_at timestamptz;
  v_updated integer;
begin
  select claimed_at into v_claimed_at
    from public.projects
   where id = p_place_id and organization_id = p_organization_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  if exists (
    select 1 from public.project_subscriptions
     where place_id = p_place_id
       and state in ('active', 'past_due')
       and cancel_at_period_end = false
  ) then
    return jsonb_build_object('ok', false, 'code', 'subscription_live');
  end if;

  update public.projects
     set organization_id   = null,
         claimed_by        = null,
         claimed_at        = null,
         claim_reviewed_at = null,
         claim_reviewed_by = null,
         plan              = 'free'
   where id = p_place_id
     and organization_id = p_organization_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  if v_claimed_at is not null then
    delete from public.project_members
     where place_id = p_place_id
       and created_at >= v_claimed_at;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
