-- MESITA-3210 — rewards add up (Pato, 2026-11-03: "(Welcome or Returning) + Story
-- + Class"). This replaces MESITA-3202's one reward per visit. A visit now holds a
-- list of rewards, reward_percent is their sum and the Cap limits the total.
-- Welcome and Returning can never meet on one visit: the first is a first visit
-- and the second is any later one.

alter table public.place_visits add column reward_kinds text[] not null default '{}';
update public.place_visits set reward_kinds = array[reward_kind] where reward_kind is not null;

drop index public.place_visits_one_welcome_idx;
-- Also drops the check that paired reward_kind with reward_percent.
alter table public.place_visits drop column reward_kind;

alter table public.place_visits
  add constraint place_visits_reward_kinds_known
    check (reward_kinds <@ array['welcome_visit', 'returning_visit', 'instagram_story', 'vip_class']::text[]),
  add constraint place_visits_welcome_or_returning
    check (not (reward_kinds @> array['welcome_visit', 'returning_visit']::text[])),
  add constraint place_visits_percent_with_rewards
    check ((cardinality(reward_kinds) = 0) = (reward_percent is null));

-- Welcome Visit once per guest per place, even if two tills race.
create unique index place_visits_one_welcome_idx on public.place_visits (place_id, consumer_id)
  where reward_kinds @> array['welcome_visit']::text[] and voided_at is null;

drop function public.place_visit_create(uuid, text, integer, text, text, uuid, uuid);

create function public.place_visit_create(
  p_place_id uuid,
  p_code_hash text,
  p_bill_cents integer,
  p_payment_method text,
  p_reward_kinds text[],
  p_request_id uuid,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  guest_id uuid;
  wanted text;
  offer record;
  kinds text[];
  percent_sum integer := 0;
  cap integer;
  discount integer := 0;
  visit public.place_visits;
begin
  select v.* into visit from public.place_visits v
   where v.place_id = p_place_id and v.request_id = p_request_id;
  if found then
    return jsonb_build_object('outcome', 'ok', 'replayed', true, 'visit', to_jsonb(visit));
  end if;

  select vc.consumer_id into guest_id
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash
     and vc.expires_at > now() and c.deleted_at is null
   for update of vc;
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;

  -- Each once, in the one order every screen shows.
  select coalesce(array_agg(c.kind order by c.ord), '{}') into kinds
    from public.place_reward_catalog() c
   where c.kind = any(coalesce(p_reward_kinds, '{}'));
  if cardinality(kinds) <> (select count(distinct x) from unnest(coalesce(p_reward_kinds, '{}')) x) then
    return jsonb_build_object('outcome', 'reward_off');
  end if;

  foreach wanted in array kinds loop
    select * into offer from public.place_rewards_for_guest(p_place_id, guest_id) r
     where r.kind = wanted;
    if not found then
      return jsonb_build_object('outcome', 'reward_off');
    end if;
    if not offer.eligible then
      return jsonb_build_object('outcome', 'not_eligible', 'reason', offer.reason);
    end if;
    percent_sum := percent_sum + offer.percent;
    cap := offer.cap_cents;
  end loop;

  if percent_sum > 0 then
    -- Half a cent rounds up, in integers, so no float ever touches money.
    discount := least(
      ((p_bill_cents::bigint * percent_sum + 50) / 100)::integer,
      coalesce(cap, p_bill_cents)
    );
  end if;

  begin
    insert into public.place_visits (
      place_id, consumer_id, bill_cents, currency, payment_method,
      reward_kinds, reward_percent, discount_cents, total_cents, request_id, created_by
    )
    select p_place_id, guest_id, p_bill_cents, p.currency, p_payment_method,
           kinds, nullif(percent_sum, 0), discount, p_bill_cents - discount, p_request_id, p_created_by
      from public.places p
     where p.id = p_place_id
    returning * into visit;
  exception when unique_violation then
    -- Another till took this guest's Welcome Visit first.
    return jsonb_build_object('outcome', 'not_eligible', 'reason', 'not_first_visit');
  end;

  delete from public.place_visit_codes vc
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash;
  return jsonb_build_object('outcome', 'ok', 'replayed', false, 'visit', to_jsonb(visit));
end;
$$;

revoke all on function public.place_visit_create(uuid, text, integer, text, text[], uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_visit_create(uuid, text, integer, text, text[], uuid, uuid) to service_role;
