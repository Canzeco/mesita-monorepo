-- MESITA-4648 (with 4771, 4696, 4666, 4649, 4545, 4457): drop what nothing
-- reads. The Edge Functions stopped reading all of it in MESITA-4649's PR.
-- Function bodies are the live ones with only the dead term removed.

-- ━━━ appear_anonymous (every profile is public, MESITA-4690) ━━━━━━━━━━━━━━━

create or replace function public.place_activity_visible(c public.consumers)
 returns boolean
 language sql
 immutable
as $function$
  select c.instagram_handle is not null
     and c.instagram_verified_at is not null
     and c.deleted_at is null
$function$;

create or replace function public.place_guest_face(p_consumer_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when c.id is null then null else jsonb_build_object(
           'avatar_url', c.avatar_url,
           'vip', c.guest_class = 'vip',
           'instagram', c.instagram_handle is not null
                        and c.instagram_verified_at is not null) end
    from (select 1) one
    left join public.consumers c on c.id = p_consumer_id
$function$;

-- `anonymous` stays: a signed-out view, or a guest without a verified
-- Instagram (MESITA-4678).
create or replace function public.place_views_log(p_place_id uuid, p_before timestamp with time zone default null::timestamp with time zone, p_limit integer default 31, p_customer text default null::text)
 returns table(consumer_id uuid, kind text, created_at timestamp with time zone, first_name text, avatar_url text, instagram_handle text, instagram_followers_count integer, guest_class text, plan text, anonymous boolean, instagram boolean, customer text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select e.consumer_id, e.kind, e.created_at,
         c.first_name,
         c.avatar_url,
         case when c.id is not null then public.place_shown_handle(c) end,
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
         not v.named,
         c.id is not null
           and c.instagram_handle is not null
           and c.instagram_verified_at is not null,
         public.place_customer_key(p_place_id, e.consumer_id)
    from public.place_views_events(p_place_id) e
    left join public.consumers c on c.id = e.consumer_id
    cross join lateral (
      select c.id is not null and public.place_activity_visible(c) as named
    ) v
   where (e.consumer_id is null or c.id is not null)
     and (p_before is null or e.created_at < p_before)
     and (p_customer is null or public.place_customer_key(p_place_id, e.consumer_id) = p_customer)
   order by e.created_at desc, e.kind
   limit least(greatest(p_limit, 1), 200)
$function$;

-- ━━━ instagram_is_private (it gated nothing, MESITA-4659) ━━━━━━━━━━━━━━━━━━
-- p_private stays: it still decides instagram_vip_status.

create or replace function public.consumer_instagram_prove(
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
         instagram_synced_at = null
   where instagram_handle = p_handle
     and id <> v_consumer;

  update public.consumers
     set instagram_proved_at = now(),
         instagram_followers_count = case when v_claim.vip_check then p_followers else instagram_followers_count end,
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

create or replace function public.consumer_instagram_set_handle(
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
           instagram_synced_at = null
     where id = p_consumer_id;
  else
    update public.consumers set instagram_handle_shown = v_show where id = p_consumer_id;
  end if;
  return v_show;
end;
$$;

-- ━━━ The drops ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

drop function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid, boolean, date, boolean, uuid);
drop function public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer);
drop function public.catalog_rank(double precision, double precision, double precision, double precision, double precision, double precision, double precision, text[], text[], boolean, boolean, double precision, double precision);

drop index public.wallet_entries_story_guest_idx;

-- A column's CHECK goes with it.
alter table public.consumers
  drop constraint consumers_profile_always_public,
  drop column appear_anonymous,
  drop column instagram_is_private,
  drop column vip_until;
alter table public.place_cashback_settings drop column story_reward_cents;
alter table public.cashback_defaults drop column story_reward_cents;
