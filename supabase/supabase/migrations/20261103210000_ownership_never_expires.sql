-- MESITA-3179: owning a place never expires (Pato, 2026-11-03: "there is no
-- until … you owned until someone kicks you out"). A live manager row's
-- expires_at is 'infinity' from now on, so every reader's
-- `expires_at > now()` stays true and only revoked_at ends access (staff
-- revoke, the owner removing a member, a transfer). place_verification_approve
-- keeps p_days in its signature and ignores it; place_invite_accept stops
-- stamping 365 days. The column stays NOT NULL with its check.

update public.place_managers
   set expires_at = 'infinity', updated_at = now()
 where revoked_at is null;

alter table public.place_managers alter column expires_at set default 'infinity';

comment on column public.place_managers.expires_at is
  'MESITA-3179: always infinity for rows written since; ownership ends only by revoked_at. Kept so readers'' expires_at > now() needs no change.';

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
     set method = p_method, verified_at = now(), expires_at = 'infinity'::timestamptz,
         note = coalesce(p_note, note), updated_at = now()
   where place_id = p_place_id and consumer_id = p_consumer_id and revoked_at is null
  returning id into v_id;

  if v_id is null then
    insert into public.place_managers (place_id, consumer_id, method, expires_at, note, role)
    values (p_place_id, p_consumer_id, p_method, 'infinity'::timestamptz, p_note, v_role)
    returning id into v_id;
  end if;

  update public.place_verification_requests
     set status = 'approved', decided_at = now(), reviewer_email = coalesce(p_reviewer, reviewer_email),
         decision_note = coalesce(decision_note, 'Verified by ' || p_method)
   where place_id = p_place_id and consumer_id = p_consumer_id and status = 'pending';

  return v_id;
end;
$function$;

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
      values (v_inv.place_id, p_consumer_id, 'invite', 'infinity'::timestamptz, 'editor', 'Invited by the owner');
    end if;
    update public.place_invites set accepted_at = now(), accepted_by = p_consumer_id where id = v_inv.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
