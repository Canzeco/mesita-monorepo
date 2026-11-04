-- MESITA-3259 — Story is the guest's choice (Pato, 2026-11-04: "make the instagram
-- story optional ... like a check list"). The tick waits with the QR's code, beside
-- the bill. Staff's page lists Story only when it was ticked, and the close refuses
-- Story when it wasn't, so the rule is the server's and not only the page's.
--
-- p_story defaults to false: the deployed function calls five arguments until the
-- integration redeploys it, minutes after this runs. A code issued in that window
-- simply has no Story.

alter table public.place_visit_codes
  add column story boolean not null default false;

comment on column public.place_visit_codes.story is
  'MESITA-3259: the guest ticked Instagram Story for this visit. Who may use Story at all is place_rewards_for_guest.';

drop function public.place_visit_code_issue(uuid, uuid, text, timestamptz, integer);

create function public.place_visit_code_issue(
  p_place_id uuid,
  p_consumer_id uuid,
  p_code_hash text,
  p_expires_at timestamptz,
  p_bill_cents integer default null,
  p_story boolean default false
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.place_visit_codes c
   where c.place_id = p_place_id and (c.consumer_id = p_consumer_id or c.expires_at <= now());
  insert into public.place_visit_codes (place_id, code_hash, consumer_id, expires_at, bill_cents, story)
  values (p_place_id, p_code_hash, p_consumer_id, p_expires_at, p_bill_cents, coalesce(p_story, false))
  on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.place_visit_code_issue(uuid, uuid, text, timestamptz, integer, boolean) from public, anon, authenticated;
grant execute on function public.place_visit_code_issue(uuid, uuid, text, timestamptz, integer, boolean) to service_role;

create or replace function public.place_visit_open(p_place_id uuid, p_code_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  checked jsonb;
  ticked boolean;
begin
  checked := public.place_visit_check(p_place_id, p_code_hash);
  if checked->>'outcome' <> 'ok' then
    return jsonb_build_object('outcome', 'bad_code');
  end if;
  select vc.story into ticked from public.place_visit_codes vc
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash;
  return jsonb_build_object(
    'outcome', 'ok',
    'guest_name', checked#>>'{guest,name}',
    'bill_cents', (select vc.bill_cents from public.place_visit_codes vc
                    where vc.place_id = p_place_id and vc.code_hash = p_code_hash),
    'place_name', (select coalesce(pp.name, pp.google_name) from public.place_profiles pp where pp.id = p_place_id),
    'currency', (select p.currency from public.places p where p.id = p_place_id),
    'code_set', exists (
      select 1 from public.place_rewards r where r.place_id = p_place_id and r.place_code_hash is not null
    ),
    'rewards', coalesce((
      select jsonb_agg(
        jsonb_build_object('kind', e.r->>'kind', 'percent', (e.r->>'percent')::integer, 'cap_cents', (e.r->>'cap_cents')::integer)
        order by e.ord
      )
      from jsonb_array_elements(checked->'rewards') with ordinality as e(r, ord)
      where (e.r->>'eligible')::boolean
        and (e.r->>'kind' <> 'instagram_story' or ticked)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.place_visit_close(
  p_place_id uuid,
  p_code_hash text,
  p_place_code_hash text,
  p_bill_cents integer,
  p_reward_kinds text[],
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  stored text;
  guest_id uuid;
  ticked boolean;
  visit public.place_visits;
  lock_ends timestamptz;
  wrong_now integer;
begin
  select r.place_code_hash into stored from public.place_rewards r where r.place_id = p_place_id;
  if stored is null then
    return jsonb_build_object('outcome', 'no_place_code');
  end if;

  if stored = p_place_code_hash then
    select v.* into visit from public.place_visits v
     where v.place_id = p_place_id and v.request_id = p_request_id;
    if found then
      return jsonb_build_object('outcome', 'ok', 'replayed', true, 'visit', to_jsonb(visit));
    end if;
  end if;

  select vc.consumer_id, vc.story into guest_id, ticked
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash
     and vc.expires_at > now() and c.deleted_at is null
   for update of vc;
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;

  select t.locked_until into lock_ends from public.place_code_tries t
   where t.place_id = p_place_id and t.consumer_id = guest_id;
  if lock_ends > now() then
    return jsonb_build_object('outcome', 'locked');
  end if;

  if stored <> p_place_code_hash then
    insert into public.place_code_tries as t (place_id, consumer_id, wrong)
    values (p_place_id, guest_id, 1)
    on conflict (place_id, consumer_id) do update set wrong = t.wrong + 1, locked_until = null
    returning t.wrong into wrong_now;
    if wrong_now >= 5 then
      update public.place_code_tries t
         set wrong = 0, locked_until = now() + interval '15 minutes'
       where t.place_id = p_place_id and t.consumer_id = guest_id;
      return jsonb_build_object('outcome', 'locked');
    end if;
    return jsonb_build_object('outcome', 'wrong_place_code');
  end if;

  delete from public.place_code_tries t where t.place_id = p_place_id and t.consumer_id = guest_id;
  if 'instagram_story' = any(coalesce(p_reward_kinds, '{}')) and not ticked then
    return jsonb_build_object('outcome', 'not_eligible', 'reason', 'story_not_ticked');
  end if;
  return public.place_visit_create(p_place_id, p_code_hash, p_bill_cents, null, p_reward_kinds, p_request_id, null);
end;
$$;
