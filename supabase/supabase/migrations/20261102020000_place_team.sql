-- MESITA-3120 — a place's team: one owner, any number of editors.
--
-- Pato, 2026-11-02: "the team has owners and editors and it's managed at the
-- place level. only one owner and multiple editors. we don't have
-- organizations layers … the only layers are places and accounts."
--
--   place_managers.role   owner | editor. At most one unrevoked owner per
--                         place (partial unique index).
--   place_invites         the owner invites an editor by Google email; the
--                         invite is accepted when that email signs in to the
--                         Business app (place_invite_accept).
--   place_verification_approve  an approved claim becomes the owner when the
--                         place has no live owner, else an editor.
--   place_transfer_owner  the owner hands the place to one of its editors.
--
-- Editors edit the profile and see Premier; the owner alone buys or stops
-- Premier, manages the team and transfers ownership (the business-web-* EFs
-- enforce it). All tables stay EF-only.

-- ── place_managers.role ──────────────────────────────────────────────────
alter table public.place_managers
  add column role text not null default 'owner' check (role in ('owner', 'editor'));

alter table public.place_managers drop constraint if exists place_managers_method_check;
alter table public.place_managers
  add constraint place_managers_method_check check (method in ('phone_match', 'phone_code', 'review', 'invite'));

-- Existing rows: the earliest unrevoked row per place stays owner; any other
-- unrevoked row on that place becomes an editor.
update public.place_managers m
   set role = 'editor', updated_at = now()
 where m.revoked_at is null
   and exists (
     select 1 from public.place_managers o
      where o.place_id = m.place_id and o.revoked_at is null and o.id <> m.id
        and (o.verified_at, o.id) < (m.verified_at, m.id)
   );

create unique index place_managers_one_owner
  on public.place_managers (place_id) where revoked_at is null and role = 'owner';

comment on column public.place_managers.role is
  'MESITA-3120 owner (one per place: team, Premier money, transfer) or editor (profile; sees Premier).';

-- ── place_invites ────────────────────────────────────────────────────────
create table public.place_invites (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 320 and position('@' in email) > 1),
  invited_by uuid references public.consumers (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.consumers (id) on delete set null,
  revoked_at timestamptz
);

create unique index place_invites_one_open
  on public.place_invites (place_id, email) where accepted_at is null and revoked_at is null;
create index place_invites_email_open
  on public.place_invites (email) where accepted_at is null and revoked_at is null;

alter table public.place_invites enable row level security;
revoke all on table public.place_invites from public, anon, authenticated;
grant all on table public.place_invites to service_role;

comment on table public.place_invites is
  'MESITA-3120 Editor invites by Google email, written by business-web-invite-editor (the owner) and accepted by place_invite_accept when that email signs in to the Business app. EF-only.';

-- ── place_verification_approve: owner if none, else editor ──────────────
create or replace function public.place_verification_approve(
  p_place_id uuid,
  p_consumer_id uuid,
  p_method text,
  p_days integer,
  p_request_id uuid default null,
  p_reviewer text default null,
  p_note text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_role text;
begin
  if p_days is null or p_days < 1 or p_days > 730 then
    raise exception 'place_verification_approve: days out of range (%)', p_days;
  end if;
  perform pg_advisory_xact_lock(hashtext('place_verification:' || p_place_id::text));

  if p_request_id is not null then
    update public.place_verification_requests
       set status = 'approved', decided_at = now(), reviewer_email = p_reviewer,
           decision_note = p_note
     where id = p_request_id and place_id = p_place_id and consumer_id = p_consumer_id
       and status = 'pending';
    if not found then
      return null;
    end if;
  end if;

  -- An expired owner no longer holds the place: free the owner seat.
  update public.place_managers
     set revoked_at = now(), revoked_by = 'expired', updated_at = now()
   where place_id = p_place_id and role = 'owner' and revoked_at is null
     and expires_at <= now() and consumer_id <> p_consumer_id;

  -- The caller's own row keeps its role (an owner re-verifying stays owner);
  -- a new row is the owner only while the seat is free.
  select role into v_role from public.place_managers
   where place_id = p_place_id and consumer_id = p_consumer_id and revoked_at is null;
  if v_role is null then
    v_role := case when exists (
      select 1 from public.place_managers
       where place_id = p_place_id and role = 'owner' and revoked_at is null
    ) then 'editor' else 'owner' end;
  end if;

  update public.place_managers
     set method = p_method, verified_at = now(), expires_at = now() + make_interval(days => p_days),
         note = coalesce(p_note, note), updated_at = now()
   where place_id = p_place_id and consumer_id = p_consumer_id and revoked_at is null
  returning id into v_id;

  if v_id is null then
    insert into public.place_managers (place_id, consumer_id, method, expires_at, note, role)
    values (p_place_id, p_consumer_id, p_method, now() + make_interval(days => p_days), p_note, v_role)
    returning id into v_id;
  end if;

  update public.place_verification_requests
     set status = 'approved', decided_at = now(), reviewer_email = coalesce(p_reviewer, reviewer_email),
         decision_note = coalesce(decision_note, 'Verified by ' || p_method)
   where place_id = p_place_id and consumer_id = p_consumer_id and status = 'pending';

  return v_id;
end;
$function$;

-- ── place_invite_accept: a signed-in Google email takes its invites ─────
create or replace function public.place_invite_accept(p_email text, p_consumer_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_inv record;
  v_count integer := 0;
begin
  for v_inv in
    select id, place_id from public.place_invites
     where email = lower(btrim(p_email)) and accepted_at is null and revoked_at is null
  loop
    perform pg_advisory_xact_lock(hashtext('place_verification:' || v_inv.place_id::text));
    -- Already on the team (any role): the invite is spent, nothing changes.
    if not exists (
      select 1 from public.place_managers
       where place_id = v_inv.place_id and consumer_id = p_consumer_id and revoked_at is null
    ) then
      insert into public.place_managers (place_id, consumer_id, method, expires_at, role, note)
      values (v_inv.place_id, p_consumer_id, 'invite', now() + interval '365 days', 'editor', 'Invited by the owner');
    end if;
    update public.place_invites set accepted_at = now(), accepted_by = p_consumer_id where id = v_inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- ── place_transfer_owner: the owner hands the place to an editor ────────
create or replace function public.place_transfer_owner(p_place_id uuid, p_to_manager_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('place_verification:' || p_place_id::text));
  if not exists (
    select 1 from public.place_managers
     where id = p_to_manager_id and place_id = p_place_id and role = 'editor'
       and revoked_at is null and expires_at > now()
  ) then
    return false;
  end if;
  update public.place_managers set role = 'editor', updated_at = now()
   where place_id = p_place_id and role = 'owner' and revoked_at is null;
  update public.place_managers set role = 'owner', updated_at = now()
   where id = p_to_manager_id;
  return true;
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.place_verification_approve(uuid, uuid, text, integer, uuid, text, text)',
    'public.place_invite_accept(text, uuid)',
    'public.place_transfer_owner(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
