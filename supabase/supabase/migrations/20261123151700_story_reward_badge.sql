-- MESITA-4746 (Pato, 2026-11-23: "Yes, enforce it"): Story rewards pay only
-- a guest with the followers badge, a public Instagram with more than 1,000
-- followers (MESITA-4745 named the rule on Me > Instagram). The first check
-- (story_reward_grant) rejects anyone else with the new reason 'no_badge';
-- a story already verified keeps its promise. storyRewardDecision
-- (_shared/story-reward.ts) mirrors the order.

alter table public.story_mentions drop constraint if exists story_mentions_reject_reason_check;
alter table public.story_mentions add constraint story_mentions_reject_reason_check
  check (reject_reason in ('no_guest', 'no_badge', 'no_tag', 'several_places', 'not_a_story', 'video',
                           'unreadable', 'off', 'repeat', 'expired', 'removed'));

create or replace function public.story_reward_grant(p_mention uuid, p_place uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m public.story_mentions;
  v_consumer uuid;
  v_cents integer;
  v_recheck timestamptz;
begin
  select * into m from public.story_mentions where id = p_mention for update;
  if m.id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if m.state <> 'checking' then
    return jsonb_build_object('ok', true, 'outcome', m.state, 'already', true);
  end if;

  -- The guest: matched at intake, else by the verified handle now.
  v_consumer := m.consumer_id;
  if v_consumer is null and m.ig_handle is not null then
    select c.id into v_consumer
      from public.consumers c
     where lower(c.instagram_handle) = m.ig_handle
       and c.instagram_verified_at is not null and c.deleted_at is null
     order by c.instagram_verified_at desc
     limit 1;
  end if;
  if v_consumer is null then
    update public.story_mentions set place_id = p_place where id = m.id;
    return public.story_reward_reject(m.id, 'no_guest', p_now);
  end if;
  update public.story_mentions set consumer_id = v_consumer, place_id = p_place where id = m.id;

  -- THE FOLLOWERS BADGE (MESITA-4746, Pato 2026-11-23: "Yes, enforce it"):
  -- a story pays only a guest who wears the badge, _shared/instagram-badge.ts:
  -- a verified Instagram with more than 1,000 followers and a public account
  -- (unknown is not public). A test-mode story counts the emulated followers,
  -- which stand in for a public account.
  if not exists (
    select 1 from public.consumers c
     where c.id = v_consumer
       and c.instagram_verified_at is not null
       and case
             when not m.livemode and c.instagram_followers_emulated is not null
               then c.instagram_followers_emulated > 1000
             else c.instagram_is_private = false and coalesce(c.instagram_followers_count, 0) > 1000
           end
  ) then
    return public.story_reward_reject(m.id, 'no_badge', p_now);
  end if;

  -- New credit is born only where Loyalty Cards is On, and the reward is not Off.
  if p_place is null or not exists (select 1 from public.place_payment_settings s
                                     where s.place_id = p_place and s.loyalty_cards) then
    return public.story_reward_reject(m.id, 'off', p_now);
  end if;
  select r.story_reward_cents into v_cents from public.place_cashback_rates(p_place) r;
  if coalesce(v_cents, 0) <= 0 then
    return public.story_reward_reject(m.id, 'off', p_now);
  end if;

  perform public.wallet_lock(v_consumer, p_place);
  -- At most one per guest per place per 7 days: a paid story, or another
  -- story of this guest here already checked and waiting (MESITA-4717).
  if exists (select 1 from public.wallet_entries e
              where e.consumer_id = v_consumer and e.place_id = p_place
                and e.livemode = m.livemode and e.kind = 'story'
                and e.created_at > p_now - interval '7 days')
     or exists (select 1 from public.story_mentions o
                 where o.consumer_id = v_consumer and o.place_id = p_place
                   and o.livemode = m.livemode and o.id <> m.id
                   and o.state in ('verified', 'rewarded')
                   and o.mentioned_at > p_now - interval '7 days') then
    return public.story_reward_reject(m.id, 'repeat', p_now);
  end if;
  -- MESITA-4717: no money yet. Checked now, checked again 10 hours later
  -- (never past the story's 23rd hour, while an honest story is still up);
  -- a test-mode emulator story rechecks after 2 minutes.
  v_recheck := case when m.source = 'emulator' then p_now + interval '2 minutes'
                    else least(p_now + interval '10 hours', m.mentioned_at + interval '23 hours') end;
  update public.story_mentions
     set state = 'verified', reward_cents = v_cents, recheck_at = v_recheck, ai_claimed_at = null
   where id = m.id;
  return jsonb_build_object('ok', true, 'outcome', 'verified', 'amount_cents', v_cents,
    'recheck_at', v_recheck, 'consumer_id', v_consumer, 'place_id', p_place);
end;
$function$;

revoke all on function public.story_reward_grant(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.story_reward_grant(uuid, uuid, timestamptz) to service_role;
