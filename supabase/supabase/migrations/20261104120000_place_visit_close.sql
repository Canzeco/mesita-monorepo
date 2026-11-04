-- MESITA-3240 — visit.mesita.ai closes a visit (Pato, 2026-11-04: "you scan, and
-- you click received and you input the actual amount and the digits"). The person
-- at the till has no account, so the place code stands in for a sign-in, and the
-- page asks for no payment method. Both columns stay filled on older visits.

alter table public.place_visits
  alter column payment_method drop not null,
  alter column created_by drop not null;

comment on column public.place_visits.payment_method is
  'MESITA-3240: null on a visit closed at visit.mesita.ai, which does not ask.';
comment on column public.place_visits.created_by is
  'MESITA-3240: null on a visit closed at visit.mesita.ai: the place code proved it, nobody signed in.';

-- Wrong place codes, per guest per place. Six digits can be guessed without a
-- limit. Not per place, or one bad actor could lock a whole restaurant's till.
create table public.place_code_tries (
  place_id uuid not null references public.places (id) on delete cascade,
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  wrong integer not null default 0,
  locked_until timestamptz,
  primary key (place_id, consumer_id)
);

comment on table public.place_code_tries is
  'MESITA-3240: wrong place codes in a row for a guest at a place. Five locks that guest there for 15 minutes. EF-only.';

alter table public.place_code_tries enable row level security;
revoke all on table public.place_code_tries from public, anon, authenticated;
grant all on table public.place_code_tries to service_role;

-- What the page shows before anyone types: the guest's first name and only the
-- rewards they can use. Whoever holds the link gets this, so no member number.
create function public.place_visit_open(p_place_id uuid, p_code_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  checked jsonb;
begin
  checked := public.place_visit_check(p_place_id, p_code_hash);
  if checked->>'outcome' <> 'ok' then
    return jsonb_build_object('outcome', 'bad_code');
  end if;
  return jsonb_build_object(
    'outcome', 'ok',
    'guest_name', checked#>>'{guest,name}',
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
    ), '[]'::jsonb)
  );
end;
$$;

-- Checks the place code, then logs the visit and spends the guest's code. A wrong
-- try returns instead of raising, so its count commits. A repeated request_id with
-- the right place code returns the visit it already made, because a retried tap
-- finds the guest's code already spent.
create function public.place_visit_close(
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

  select vc.consumer_id into guest_id
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
  return public.place_visit_create(p_place_id, p_code_hash, p_bill_cents, null, p_reward_kinds, p_request_id, null);
end;
$$;

revoke all on function public.place_visit_open(uuid, text) from public, anon, authenticated;
revoke all on function public.place_visit_close(uuid, text, text, integer, text[], uuid) from public, anon, authenticated;
grant execute on function public.place_visit_open(uuid, text) to service_role;
grant execute on function public.place_visit_close(uuid, text, text, integer, text[], uuid) to service_role;
