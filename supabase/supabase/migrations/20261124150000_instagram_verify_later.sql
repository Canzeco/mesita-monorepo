-- MESITA-4858 — Add Instagram now, verify it later. Pato, 2026-11-24.
--
-- 1. A handle is saved UNVERIFIED (consumer_instagram_set_handle) and may be
--    shared unverified. instagram_proved_at is the verified badge.
--    instagram_verified_at keeps its older meaning, when the handle was added.
-- 2. The badge comes only from the DM: a 15-minute, single-use code tied to the
--    guest and the handle, from the matching account (consumer_instagram_prove).
-- 3. A changed or removed handle loses its proof, VIP check and pending code,
--    whoever writes it (trigger). A handle another guest proved cannot be shared
--    unproved.
-- 4. VIP: only with the guest's yes before the DM, a proved public account with
--    more than 5,000 followers. Not knowing either fact is 'unconfirmed'.
-- 5. The scrape path is gone: consumer_instagram_verify, _sync, _claim_scrape.
--
-- Rollback: 20261124140000's level and verify, 20261117150000's sync,
-- 20261029110000's claim_scrape, 20261124110000's class and money rule.

alter table public.consumers
  add column instagram_vip_status text
    check (instagram_vip_status in ('eligible', 'not_enough', 'not_public', 'unconfirmed')),
  add column instagram_vip_checked_at timestamptz;

comment on column public.consumers.instagram_vip_status is
  'MESITA-4858: the follower check the guest allowed, or null. Only eligible makes a VIP, and only with instagram_proved_at. Written by consumer_instagram_prove.';
comment on column public.consumers.instagram_verified_at is
  'When the guest added the handle (the name is historic); it proves nothing. The verified badge is instagram_proved_at (MESITA-4858).';
comment on column public.consumers.instagram_proved_at is
  'MESITA-4858: when a DM proved this guest owns instagram_handle: the verified badge. Reset by a trigger when the handle changes. Written by consumer_instagram_prove.';

-- A pending code now always names its handle; older codes are dead.
delete from public.consumer_instagram_claims;
alter table public.consumer_instagram_claims
  alter column handle set not null,
  add column vip_check boolean not null default false,
  add column failed_reason text check (failed_reason in ('wrong_account'));
comment on table public.consumer_instagram_claims is
  'MESITA-4858: a pending DM verification: the guest, the handle and the single-use code they send Mesita on Instagram, whether they allowed the follower check, and the last refusal. Lives 15 minutes. EF-only (RLS, no policies).';

create function public.consumers_instagram_reset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.instagram_handle is distinct from old.instagram_handle then
    new.instagram_proved_at := null;
    new.instagram_vip_status := null;
    new.instagram_vip_checked_at := null;
    delete from public.consumer_instagram_claims where consumer_id = new.id;
  end if;
  if new.instagram_handle is not null
     and new.instagram_handle_shown is true
     and new.instagram_proved_at is null
     and (new.instagram_handle is distinct from old.instagram_handle
          or old.instagram_handle_shown is distinct from true)
     and exists (
       select 1 from public.consumers o
        where o.instagram_handle = new.instagram_handle
          and o.instagram_proved_at is not null
          and o.deleted_at is null
          and o.id <> new.id
     ) then
    raise exception 'handle_proved_elsewhere';
  end if;
  return new;
end;
$$;
revoke all on function public.consumers_instagram_reset() from public, anon, authenticated;

create trigger consumers_instagram_reset
  before update of instagram_handle, instagram_handle_shown on public.consumers
  for each row execute function public.consumers_instagram_reset();

create index consumers_instagram_handle_idx on public.consumers (instagram_handle)
  where instagram_handle is not null;

-- Add or change the handle. p_show null = keep the choice for the same handle,
-- hidden for a new one. Returns whether it is shared.
create function public.consumer_instagram_set_handle(
  p_consumer_id uuid,
  p_handle text,
  p_show boolean default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_show boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('instagram_handle:' || p_handle, 0));
  select instagram_handle, instagram_handle_shown into v_old, v_show
    from public.consumers
   where id = p_consumer_id and deleted_at is null
   for update;
  if not found then
    raise exception 'consumer_not_found';
  end if;
  v_show := coalesce(p_show, case when v_old = p_handle then v_show end, false);
  -- Its owner verified it on another account: saved, but never shown as theirs.
  if v_old is distinct from p_handle and exists (
    select 1 from public.consumers o
     where o.instagram_handle = p_handle
       and o.instagram_proved_at is not null
       and o.deleted_at is null
       and o.id <> p_consumer_id
  ) then
    v_show := false;
  end if;

  if v_old is distinct from p_handle then
    update public.consumers
       set instagram_handle = p_handle,
           instagram_handle_shown = v_show,
           instagram_verified_at = now(),
           instagram_followers_count = null,
           instagram_is_private = null,
           instagram_synced_at = null
     where id = p_consumer_id;
  else
    update public.consumers set instagram_handle_shown = v_show where id = p_consumer_id;
  end if;
  return v_show;
end;
$$;
revoke all on function public.consumer_instagram_set_handle(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_set_handle(uuid, text, boolean) to service_role;

-- The DM landed: p_handle is the sender's, from Meta. Returns
-- verified | wrong_account | expired | unknown.
create function public.consumer_instagram_prove(
  p_code text,
  p_handle text,
  p_followers integer default null,
  p_private boolean default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer uuid;
  v_claim public.consumer_instagram_claims;
begin
  perform pg_advisory_xact_lock(hashtextextended('instagram_handle:' || p_handle, 0));
  select consumer_id into v_consumer from public.consumer_instagram_claims where code = p_code;
  if not found then
    return 'unknown';
  end if;
  -- The guest row first, as a handle change takes them.
  perform 1 from public.consumers where id = v_consumer for update;
  select * into v_claim from public.consumer_instagram_claims where code = p_code for update;
  if not found then
    return 'unknown';
  end if;
  if v_claim.created_at < now() - interval '15 minutes' then
    return 'expired';
  end if;
  if v_claim.handle <> p_handle then
    update public.consumer_instagram_claims set failed_reason = 'wrong_account' where code = p_code;
    return 'wrong_account';
  end if;

  update public.consumers
     set instagram_handle = null,
         instagram_verified_at = null,
         instagram_handle_shown = null,
         instagram_followers_count = null,
         instagram_is_private = null,
         instagram_synced_at = null
   where instagram_handle = p_handle
     and id <> v_consumer;

  update public.consumers
     set instagram_proved_at = now(),
         instagram_followers_count = case when v_claim.vip_check then p_followers else instagram_followers_count end,
         instagram_is_private = case when v_claim.vip_check then p_private else instagram_is_private end,
         instagram_vip_status = case
           when not v_claim.vip_check then instagram_vip_status
           when p_followers is null then 'unconfirmed'
           when p_followers <= 5000 then 'not_enough'
           when p_private is null then 'unconfirmed'
           when p_private then 'not_public'
           else 'eligible'
         end,
         instagram_vip_checked_at = case when v_claim.vip_check then now() else instagram_vip_checked_at end
   where id = v_consumer
     and instagram_handle = p_handle
     and deleted_at is null;
  if not found then
    return 'unknown';
  end if;
  delete from public.consumer_instagram_claims where code = p_code;
  return 'verified';
end;
$$;
revoke all on function public.consumer_instagram_prove(text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_prove(text, text, integer, boolean) to service_role;

create or replace function public.consumer_social_level(c public.consumers)
returns text
language sql
stable
as $$
  select case
           when c.social_private
             or c.birth_year is null
             or extract(year from now() at time zone 'utc')::integer - c.birth_year < 19
             then 'private'
           when c.instagram_handle is not null
            and c.instagram_verified_at is not null
            and c.instagram_handle_shown is true
             then 'instagram'
           else 'public'
         end
$$;

alter table public.consumers
  alter column guest_class set expression as (
    case
      when vip_invited_at is not null
        or (instagram_proved_at is not null and instagram_vip_status = 'eligible')
        then 'vip'
      else 'regular'
    end
  );
comment on column public.consumers.guest_class is
  'MESITA-4858: vip by invitation code, or by a DM-verified public Instagram with more than 5,000 followers the guest let Mesita check; else regular. What screens show. Money asks consumer_is_vip_for_money.';

create or replace function public.consumer_is_vip_for_money(p_consumer uuid, p_livemode boolean)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select c.vip_invited_at is not null
        or (c.instagram_proved_at is not null and c.instagram_vip_status = 'eligible')
      from public.consumers c
     where c.id = p_consumer
  ), false);
$function$;
revoke all on function public.consumer_is_vip_for_money(uuid, boolean) from public, anon, authenticated;
grant execute on function public.consumer_is_vip_for_money(uuid, boolean) to service_role;
comment on function public.consumer_is_vip_for_money(uuid, boolean) is
  'MESITA-4858: whether this guest is paid as VIP: an invitation code, or a DM-verified eligible Instagram. Typed usernames and emulated counts never count.';

drop function public.consumer_instagram_verify(uuid, text, integer, boolean, boolean);
drop function public.consumer_instagram_sync(uuid, text, integer, boolean);
drop function public.consumer_instagram_claim_scrape(uuid, text, integer, integer);
