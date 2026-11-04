-- MESITA-3202 — Visits and Rewards work (Pato, 2026-11-03: "visits and rewards
-- must be functional").
--
--   place_rewards      what a place has switched on, one row per place. Pato,
--                      same day: Welcome Visit 20%, Returning Visit 10%,
--                      Instagram Story 20%, VIP Class 20%, "on or off, not in
--                      between", and a Cap, on or off, of 200 pesos a bill. The
--                      percents and the cap are fixed here for the moment. No
--                      row = everything off.
--   place_visit_codes  the six digits a guest shows staff: one place, ten
--                      minutes, one use. Only a hash is stored. Not the member
--                      number: those are sequential, so typing them would let
--                      any place read guests' names.
--   place_visits       the log: who came, the bill, the reward, how it was paid.
--
-- Discounts only: no cashback, balance or credit, and no money moves through
-- Mesita. The place records what happened at its own till. One reward per
-- visit. Every rule and every peso is decided here; the EFs and screens only
-- carry it. EF-only tables: RLS on, no policies, client roles hold nothing.

create table public.place_rewards (
  place_id uuid primary key references public.places (id) on delete cascade,
  welcome_visit boolean not null default false,
  returning_visit boolean not null default false,
  instagram_story boolean not null default false,
  vip_class boolean not null default false,
  cap boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.place_rewards is
  'MESITA-3202: which rewards a place has on, and whether the bill cap applies. No row means all off. EF-only.';

create table public.place_visit_codes (
  place_id uuid not null references public.places (id) on delete cascade,
  code_hash text not null,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (place_id, code_hash),
  unique (place_id, consumer_id)
);

comment on table public.place_visit_codes is
  'MESITA-3202: the code a guest shows staff. One live code per guest per place; deleted when spent. EF-only.';

create table public.place_visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete restrict,
  -- Null once the guest's account is gone: the place's record stays.
  consumer_id uuid references public.consumers (id) on delete set null,
  bill_cents integer not null check (bill_cents between 1 and 100000000),
  currency text not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'transfer', 'other')),
  reward_kind text check (reward_kind in ('welcome_visit', 'returning_visit', 'instagram_story', 'vip_class')),
  reward_percent integer check (reward_percent between 1 and 100),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  request_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  unique (place_id, request_id),
  check ((reward_kind is null) = (reward_percent is null)),
  check (total_cents = bill_cents - discount_cents),
  check ((voided_at is null) = (voided_by is null))
);

comment on table public.place_visits is
  'MESITA-3202: a guest physically at a place, confirmed by its staff. A record of the place''s own till, never a Mesita charge. Voided, never deleted. EF-only.';

create index place_visits_place_idx on public.place_visits (place_id, created_at desc);
create index place_visits_guest_idx on public.place_visits (consumer_id, place_id);
-- Welcome Visit once per guest per place, even if two tills race.
create unique index place_visits_one_welcome_idx on public.place_visits (place_id, consumer_id)
  where reward_kind = 'welcome_visit' and voided_at is null;

alter table public.place_rewards enable row level security;
alter table public.place_visit_codes enable row level security;
alter table public.place_visits enable row level security;
revoke all on table public.place_rewards, public.place_visit_codes, public.place_visits
  from public, anon, authenticated;
grant all on table public.place_rewards, public.place_visit_codes, public.place_visits
  to service_role;

-- The rewards and what each is worth. The one place these numbers live.
create function public.place_reward_catalog()
returns table (kind text, percent integer, ord integer)
language sql
immutable
set search_path to 'public'
as $$
  values ('welcome_visit', 20, 1), ('returning_visit', 10, 2),
         ('instagram_story', 20, 3), ('vip_class', 20, 4)
$$;

-- The most a discount can be on one bill when a place's Cap is on: 200 pesos.
create function public.place_reward_cap_cents()
returns integer
language sql
immutable
set search_path to 'public'
as $$ select 20000 $$;

-- What a place has set, for its own Rewards page.
create function public.place_rewards_read(p_place_id uuid)
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
      'enabled', coalesce((select r.cap from public.place_rewards r where r.place_id = p_place_id), false)
    )
  )
$$;

-- What this place offers this guest, in the one order every screen shows.
-- Welcome Visit is a first visit, Returning Visit any later one, VIP Class a
-- guest Mesita marks VIP. Instagram Story is any visit: staff check the story on
-- the guest's phone. p_consumer null is a signed-out read: the offers, none of
-- them eligible.
create function public.place_rewards_for_guest(p_place_id uuid, p_consumer_id uuid)
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
      coalesce((select c.guest_class::text = 'vip' from public.consumers c where c.id = p_consumer_id), false) as is_vip
  )
  select c.kind, c.percent,
    case when r.cap then public.place_reward_cap_cents() end,
    case
      when p_consumer_id is null then false
      when c.kind = 'welcome_visit' then not f.been_here
      when c.kind = 'returning_visit' then f.been_here
      when c.kind = 'vip_class' then f.is_vip
      else true
    end,
    case
      when p_consumer_id is null then 'signed_out'
      when c.kind = 'welcome_visit' and f.been_here then 'not_first_visit'
      when c.kind = 'returning_visit' and not f.been_here then 'first_visit'
      when c.kind = 'vip_class' and not f.is_vip then 'not_vip'
    end
  from public.place_rewards r
  cross join public.place_reward_catalog() c
  cross join facts f
  where r.place_id = p_place_id and (to_jsonb(r)->>c.kind)::boolean
  order by c.ord;
$$;

-- A fresh code for this guest here, replacing their last one. False when the
-- digits collide with another guest's live code here: the EF draws again.
create function public.place_visit_code_issue(
  p_place_id uuid, p_consumer_id uuid, p_code_hash text, p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.place_visit_codes c
   where c.place_id = p_place_id and (c.consumer_id = p_consumer_id or c.expires_at <= now());
  insert into public.place_visit_codes (place_id, code_hash, consumer_id, expires_at)
  values (p_place_id, p_code_hash, p_consumer_id, p_expires_at)
  on conflict do nothing;
  return found;
end;
$$;

-- Who a code belongs to and what they may use. Spends nothing.
create function public.place_visit_check(p_place_id uuid, p_code_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  guest public.consumers;
begin
  select c.* into guest
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash
     and vc.expires_at > now() and c.deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;
  return jsonb_build_object(
    'outcome', 'ok',
    'guest', jsonb_build_object('name', guest.first_name, 'member_number', guest.code),
    'rewards', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.place_rewards_for_guest(p_place_id, guest.id) r
    ), '[]'::jsonb)
  );
end;
$$;

-- Logs one visit and spends the code, together. A repeated request_id returns
-- the visit it already made, so a retried tap never logs twice or fails on its
-- own spent code.
create function public.place_visit_create(
  p_place_id uuid,
  p_code_hash text,
  p_bill_cents integer,
  p_payment_method text,
  p_reward_kind text,
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
  offer record;
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

  if p_reward_kind is not null then
    select * into offer from public.place_rewards_for_guest(p_place_id, guest_id) r
     where r.kind = p_reward_kind;
    if not found then
      return jsonb_build_object('outcome', 'reward_off');
    end if;
    if not offer.eligible then
      return jsonb_build_object('outcome', 'not_eligible', 'reason', offer.reason);
    end if;
    -- Half a cent rounds up, in integers, so no float ever touches money.
    discount := least(
      ((p_bill_cents::bigint * offer.percent + 50) / 100)::integer,
      coalesce(offer.cap_cents, p_bill_cents)
    );
  end if;

  begin
    insert into public.place_visits (
      place_id, consumer_id, bill_cents, currency, payment_method,
      reward_kind, reward_percent, discount_cents, total_cents, request_id, created_by
    )
    select p_place_id, guest_id, p_bill_cents, p.currency, p_payment_method,
           p_reward_kind, offer.percent, discount, p_bill_cents - discount, p_request_id, p_created_by
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

-- A mistake is voided, never deleted. Voiding again changes nothing. A voided
-- visit no longer counts as having been here, so Welcome Visit opens again.
create function public.place_visit_void(p_place_id uuid, p_visit_id uuid, p_voided_by uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  visit public.place_visits;
begin
  update public.place_visits v
     set voided_at = now(), voided_by = p_voided_by
   where v.id = p_visit_id and v.place_id = p_place_id and v.voided_at is null
  returning * into visit;
  if found then
    return jsonb_build_object('outcome', 'ok', 'visit', to_jsonb(visit));
  end if;
  select v.* into visit from public.place_visits v
   where v.id = p_visit_id and v.place_id = p_place_id;
  if found then
    return jsonb_build_object('outcome', 'ok', 'visit', to_jsonb(visit));
  end if;
  return jsonb_build_object('outcome', 'not_found');
end;
$$;

revoke all on function public.place_reward_catalog() from public, anon, authenticated;
revoke all on function public.place_reward_cap_cents() from public, anon, authenticated;
revoke all on function public.place_rewards_read(uuid) from public, anon, authenticated;
revoke all on function public.place_rewards_for_guest(uuid, uuid) from public, anon, authenticated;
revoke all on function public.place_visit_code_issue(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.place_visit_check(uuid, text) from public, anon, authenticated;
revoke all on function public.place_visit_create(uuid, text, integer, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.place_visit_void(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_reward_catalog() to service_role;
grant execute on function public.place_reward_cap_cents() to service_role;
grant execute on function public.place_rewards_read(uuid) to service_role;
grant execute on function public.place_rewards_for_guest(uuid, uuid) to service_role;
grant execute on function public.place_visit_code_issue(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.place_visit_check(uuid, text) to service_role;
grant execute on function public.place_visit_create(uuid, text, integer, text, text, uuid, uuid) to service_role;
grant execute on function public.place_visit_void(uuid, uuid, uuid) to service_role;
