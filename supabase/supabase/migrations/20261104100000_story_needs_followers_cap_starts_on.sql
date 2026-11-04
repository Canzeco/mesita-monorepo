-- MESITA-3224 — Story's follower rule becomes real, and the Cap starts on.
--
-- VIP Class pays for the room, Instagram Story for the post. The follower bar
-- keeps Story a minority reward, and until now it was only words on the screen:
-- every guest counted as eligible. The count comes from the verified claim
-- (consumer_instagram_verify scrapes it; the app's own number is ignored). Staff
-- still check the story itself and that the profile is public, which Mesita
-- cannot see.
--
-- The Cap is on by default, for a place's first switch and for the page before
-- it. An owner can turn it off. No place has a row yet, so nothing is rewritten.

-- The bar, inclusive. Twin of INSTAGRAM_REACH_FOLLOWERS in
-- apps/web-consumer/src/lib/consumer-identity.ts; instagram-reach.test.ts fails
-- when they disagree.
create function public.place_reward_story_followers()
returns integer
language sql
immutable
as $$ select 1000 $$;

create or replace function public.place_rewards_for_guest(p_place_id uuid, p_consumer_id uuid)
returns table (kind text, percent integer, cap_cents integer, eligible boolean, reason text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with facts as (
    select
      exists (
        select 1 from public.place_visits v
         where v.place_id = p_place_id and v.consumer_id = p_consumer_id and v.voided_at is null
      ) as been_here,
      coalesce((select c.guest_class::text = 'vip' from public.consumers c where c.id = p_consumer_id), false) as is_vip,
      (select c.instagram_followers_count from public.consumers c
        where c.id = p_consumer_id and c.instagram_verified_at is not null) as followers
  )
  select c.kind, c.percent,
    case when r.cap then public.place_reward_cap_cents() end,
    case
      when p_consumer_id is null then false
      when c.kind = 'welcome_visit' then not f.been_here
      when c.kind = 'returning_visit' then f.been_here
      when c.kind = 'vip_class' then f.is_vip
      when c.kind = 'instagram_story' then coalesce(f.followers >= public.place_reward_story_followers(), false)
      else true
    end,
    case
      when p_consumer_id is null then 'signed_out'
      when c.kind = 'welcome_visit' and f.been_here then 'not_first_visit'
      when c.kind = 'returning_visit' and not f.been_here then 'first_visit'
      when c.kind = 'vip_class' and not f.is_vip then 'not_vip'
      when c.kind = 'instagram_story' and f.followers is null then 'instagram_not_connected'
      when c.kind = 'instagram_story' and f.followers < public.place_reward_story_followers() then 'not_enough_followers'
    end
  from public.place_rewards r
  cross join public.place_reward_catalog() c
  cross join facts f
  where r.place_id = p_place_id and (to_jsonb(r)->>c.kind)::boolean
  order by c.ord;
$$;

alter table public.place_rewards alter column cap set default true;

create or replace function public.place_rewards_read(p_place_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'rewards', (
      select jsonb_agg(jsonb_build_object(
        'kind', c.kind,
        'percent', c.percent,
        'enabled', coalesce((to_jsonb(r)->>c.kind)::boolean, false)
      ) order by c.ord)
      from public.place_reward_catalog() c
      left join public.place_rewards r on r.place_id = p_place_id
    ),
    'cap', jsonb_build_object(
      'cents', public.place_reward_cap_cents(),
      'enabled', coalesce((select r.cap from public.place_rewards r where r.place_id = p_place_id), true)
    )
  )
$$;

revoke all on function public.place_reward_story_followers() from public, anon, authenticated;
grant execute on function public.place_reward_story_followers() to service_role;
