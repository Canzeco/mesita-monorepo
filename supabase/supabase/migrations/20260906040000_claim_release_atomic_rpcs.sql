-- MESITA-1537 (the activation funnel) — claim and release become ATOMIC.
--
-- Claiming a place must MATERIALIZE ownership: the funnel's owner-gated
-- features (staff PIN, Partnership subscription, team transfer) all key on a
-- project_members owner ROW (one-owner partial index, MESITA-919), and an
-- org-claimed place had none — every claim dead-ended. supabase-js has no
-- multi-statement transactions, so the claim update and the owner upsert
-- live in ONE SQL function; likewise release and its tenure-era membership
-- cleanup. EF-only (service_role); the EFs keep the org-role guards.

-- ── claim ────────────────────────────────────────────────────────────────
-- Guarded claim (organization_id IS NULL is the lock) + owner UPSERT that
-- PROMOTES an existing editor/viewer row rather than inserting beside it.
-- A concurrent old-style owner grant (admin-web-decide-verification) trips
-- the one-owner index; the whole transaction rolls back and the caller gets
-- owner_conflict — never a half-claimed place.

create or replace function public.claim_place_into_org(
  p_place_id uuid,
  p_organization_id uuid,
  p_claimer uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  -- The pool predicate's second fact (place-claim.ts): a direct owner keeps
  -- a place out of the pool no matter what organization_id says.
  if exists (
    select 1 from public.project_members
     where place_id = p_place_id and role = 'owner'
  ) then
    return jsonb_build_object('ok', false, 'code', 'not_claimable');
  end if;

  update public.projects
     set organization_id = p_organization_id,
         claimed_by      = p_claimer,
         claimed_at      = now()
   where id = p_place_id
     and organization_id is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    -- Missing row and just-claimed collapse to one honest answer.
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  insert into public.project_members (place_id, manager_id, role)
  values (p_place_id, p_claimer, 'owner')
  on conflict (place_id, manager_id) do update set role = 'owner';

  return jsonb_build_object('ok', true, 'claimed_at', now());
exception
  when unique_violation then
    -- The one-owner index: an owner row raced in between the predicate and
    -- the upsert. Everything above rolls back with this subtransaction.
    return jsonb_build_object('ok', false, 'code', 'owner_conflict');
end;
$$;

-- ── release ──────────────────────────────────────────────────────────────
-- Blocked while a Partnership subscription is genuinely live (active or
-- past_due AND not already winding down) — the funnel must never strand a
-- paid place in the pool. Resets plan to free (the next claimer inherits no
-- paid plan). Deletes TENURE-ERA membership rows only: everything created
-- at-or-after this tenure's claimed_at (the materialized owner, invites made
-- during tenure, a transfer-created owner) — rows predating the claim
-- survive. The delete is guarded by the captured claimed_at, so a stale
-- release can never touch a fresh tenure's rows.

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
     set organization_id = null,
         claimed_by      = null,
         claimed_at      = null,
         plan            = 'free'
   where id = p_place_id
     and organization_id = p_organization_id;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  end if;

  -- Null claimed_at on an org-held place should not exist (the claim writes
  -- it); if it somehow does, delete nothing rather than guess an era.
  if v_claimed_at is not null then
    delete from public.project_members
     where place_id = p_place_id
       and created_at >= v_claimed_at;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── backfill ─────────────────────────────────────────────────────────────
-- Places claimed BEFORE this migration (under the old claim EF) are org-held
-- with no owner row — the dead-end itself. Materialize the claimer's owner
-- row for each, exactly as the RPC would have: promote an existing
-- membership or insert one. Skip any place that somehow already has an
-- owner (the one-owner index stays sovereign). Replay-safe: empty tables
-- backfill nothing.

do $$
declare r record;
begin
  for r in
    select p.id as place_id, p.claimed_by, p.claimed_at
      from public.projects p
     where p.organization_id is not null
       and p.claimed_by is not null
       and not exists (
         select 1 from public.project_members m
          where m.place_id = p.id and m.role = 'owner')
  loop
    insert into public.project_members (place_id, manager_id, role, created_at)
    values (r.place_id, r.claimed_by, 'owner', coalesce(r.claimed_at, now()))
    on conflict (place_id, manager_id) do update set role = 'owner';
  end loop;
end $$;

revoke execute on function public.claim_place_into_org(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_place_into_org(uuid, uuid, uuid) to service_role;
revoke execute on function public.release_place_from_org(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_place_from_org(uuid, uuid) to service_role;
