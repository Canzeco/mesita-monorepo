-- MESITA-3270 — the pay flow is a shared visit (Pato, 2026-11-04: "Billtip ·
-- Reward · Task · Pay · who confirms"; he chose "C: shared visit"). The scan opens
-- one visit on both phones. Staff type the bill, the guest confirms it; the server
-- lists what applies; the guest shows the Story and staff tap Seen it; the guest
-- pays and staff tap Received. Whoever knows the fact confirms it: the guest the
-- money, staff the proof and the receipt.
--
-- The open visit IS the guest's code row (place_visit_codes): one live row per
-- guest per place, already read by both sides. It gains the stamps, and the close
-- (place_visit_create) still turns it into a place_visits row and deletes it.
-- Replaces the guest-typed bill of MESITA-3245/3266: bill_cents is now staff's
-- number, and bill_confirmed_at is the guest's signature on it. story is no longer
-- the guest's tick at issue (MESITA-3259); it is staff's Seen it at the Task step.
-- Tip stays out until Stripe.
--
-- The guest holds the same link staff open, so the link alone proves nothing about
-- who is tapping. Every staff stamp (the bill, Seen it, Received) therefore carries
-- the place code, with the same wrong-try lock as the close. Staff type it once, with
-- the bill. The guest's stamps go by their account and never by the link.

alter table public.place_visit_codes
  add column opened_at timestamptz,
  add column bill_confirmed_at timestamptz,
  add column task_seen_at timestamptz,
  add column task_skipped_at timestamptz;

comment on column public.place_visit_codes.opened_at is
  'MESITA-3270: staff scanned the QR (or typed the codes). The guest stops replacing the code after this.';
comment on column public.place_visit_codes.bill_cents is
  'MESITA-3270: the bill staff typed from the ticket, before any discount or tip. Null until they do.';
comment on column public.place_visit_codes.bill_confirmed_at is
  'MESITA-3270: the guest confirmed bill_cents. Cleared when staff change the bill. The close needs it.';
comment on column public.place_visit_codes.story is
  'MESITA-3270: Story counts on this visit; set by staff''s Seen it at the Task step. Who may use Story at all is place_rewards_for_guest.';
comment on column public.place_visit_codes.task_seen_at is
  'MESITA-3270: staff saw the posted Story.';
comment on column public.place_visit_codes.task_skipped_at is
  'MESITA-3270: the guest or staff passed on the Story for this visit.';

-- How long an opened visit stays alive after each stamp: a table takes longer
-- than the QR's ten minutes.
create function public.place_visit_lease()
returns interval
language sql
immutable
set search_path to 'public'
as $$ select interval '60 minutes' $$;

-- What a bill costs with these rewards: the same sum place_visit_create does
-- (percents add up, half a cent rounds up, then the Cap), so both phones read
-- the number the close will log. Null bill, null quote.
create function public.place_visit_quote(p_bill_cents integer, p_rewards jsonb)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select case when p_bill_cents is null then null else (
    with r as (
      select coalesce(sum((e->>'percent')::integer), 0)::integer as percent,
             min((e->>'cap_cents')::integer) as cap
        from jsonb_array_elements(coalesce(p_rewards, '[]'::jsonb)) e
    )
    select jsonb_build_object(
      'percent', r.percent,
      'discount_cents', least(((p_bill_cents::bigint * r.percent + 50) / 100)::integer, coalesce(r.cap, p_bill_cents), p_bill_cents),
      'total_cents', p_bill_cents - least(((p_bill_cents::bigint * r.percent + 50) / 100)::integer, coalesce(r.cap, p_bill_cents), p_bill_cents)
    ) from r
  ) end
$$;

-- The one picture of an open visit, read by both phones. The rewards are the ones
-- this guest can use here, Story among them only once staff saw it. `step` is the
-- server's: bill until the guest confirmed it, task while a Story is offered and
-- unresolved, then pay. Reward is a screen each phone shows on its own between.
create function public.place_visit_state(p_place_id uuid, p_code_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  vc public.place_visit_codes;
  guest public.consumers;
  offered jsonb;
  counted jsonb;
  with_story jsonb;
  story_offered boolean;
begin
  select c.* into vc from public.place_visit_codes c
   where c.place_id = p_place_id and c.code_hash = p_code_hash and c.expires_at > now();
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;
  select c.* into guest from public.consumers c where c.id = vc.consumer_id and c.deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('kind', r.kind, 'percent', r.percent, 'cap_cents', r.cap_cents)), '[]'::jsonb)
    into offered
    from public.place_rewards_for_guest(p_place_id, guest.id) r
   where r.eligible;
  story_offered := offered @> '[{"kind": "instagram_story"}]'::jsonb;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into counted
    from jsonb_array_elements(offered) e
   where e->>'kind' <> 'instagram_story' or vc.story;
  with_story := case when story_offered then offered else null end;

  return jsonb_build_object(
    'outcome', 'ok',
    'guest_name', guest.first_name,
    'place_name', (select coalesce(pp.name, pp.google_name) from public.place_profiles pp where pp.id = p_place_id),
    'currency', (select p.currency from public.places p where p.id = p_place_id),
    'code_set', exists (
      select 1 from public.place_rewards r where r.place_id = p_place_id and r.place_code_hash is not null
    ),
    'expires_at', vc.expires_at,
    'opened_at', vc.opened_at,
    'bill_cents', vc.bill_cents,
    'bill_confirmed_at', vc.bill_confirmed_at,
    'story', vc.story,
    'story_offered', story_offered,
    'task_seen_at', vc.task_seen_at,
    'task_skipped_at', vc.task_skipped_at,
    'rewards', counted,
    'quote', public.place_visit_quote(vc.bill_cents, counted),
    'quote_with_story', public.place_visit_quote(vc.bill_cents, with_story),
    'step', case
      when vc.bill_cents is null or vc.bill_confirmed_at is null then 'bill'
      when story_offered and vc.task_seen_at is null and vc.task_skipped_at is null then 'task'
      else 'pay'
    end
  );
end;
$$;

-- The guest's own open visit here, by account instead of by secret: the phone
-- that made the QR reads it without ever storing the code.
create function public.place_visit_state_for_guest(p_place_id uuid, p_consumer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select public.place_visit_state(p_place_id, vc.code_hash)
      from public.place_visit_codes vc
     where vc.place_id = p_place_id and vc.consumer_id = p_consumer_id and vc.expires_at > now()
  ), jsonb_build_object('outcome', 'none'))
$$;

-- Staff opened the visit: the scan (or the typed codes) lands here. The first
-- opening stamps it and gives the table an hour. The page polls this, so reading it
-- again changes nothing: a page left open cannot keep a visit alive.
create or replace function public.place_visit_open(p_place_id uuid, p_code_hash text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.place_visit_codes vc
     set opened_at = now(),
         expires_at = greatest(vc.expires_at, now() + public.place_visit_lease())
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash and vc.expires_at > now()
     and vc.opened_at is null
     and exists (select 1 from public.consumers c where c.id = vc.consumer_id and c.deleted_at is null);
  return public.place_visit_state(p_place_id, p_code_hash);
end;
$$;

-- Is this staff, on this open visit? The place code, with five wrong tries per guest
-- per place before a 15-minute lock. A wrong try returns instead of raising, so its
-- count commits. Answers 'ok' or the refusal.
create function public.place_visit_staff_check(p_place_id uuid, p_code_hash text, p_place_code_hash text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  stored text;
  guest_id uuid;
  lock_ends timestamptz;
  wrong_now integer;
begin
  select r.place_code_hash into stored from public.place_rewards r where r.place_id = p_place_id;
  if stored is null then
    return 'no_place_code';
  end if;

  select vc.consumer_id into guest_id
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash
     and vc.expires_at > now() and c.deleted_at is null;
  if not found then
    return 'bad_code';
  end if;

  select t.locked_until into lock_ends from public.place_code_tries t
   where t.place_id = p_place_id and t.consumer_id = guest_id;
  if lock_ends > now() then
    return 'locked';
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
      return 'locked';
    end if;
    return 'wrong_place_code';
  end if;

  delete from public.place_code_tries t where t.place_id = p_place_id and t.consumer_id = guest_id;
  return 'ok';
end;
$$;

-- Billtip, staff's half: the bill from the ticket. A changed bill needs the
-- guest's confirmation again.
create function public.place_visit_set_bill(p_place_id uuid, p_code_hash text, p_place_code_hash text, p_bill_cents integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  checked text;
begin
  checked := public.place_visit_staff_check(p_place_id, p_code_hash, p_place_code_hash);
  if checked <> 'ok' then
    return jsonb_build_object('outcome', checked);
  end if;
  update public.place_visit_codes vc
     set bill_cents = p_bill_cents,
         bill_confirmed_at = case when vc.bill_cents = p_bill_cents then vc.bill_confirmed_at end,
         opened_at = coalesce(vc.opened_at, now()),
         expires_at = greatest(vc.expires_at, now() + public.place_visit_lease())
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash and vc.expires_at > now();
  return public.place_visit_state(p_place_id, p_code_hash);
end;
$$;

-- Billtip, the guest's half: the number they confirm has to be the number on
-- the row, or staff changed it under them and they confirm again.
create function public.place_visit_confirm_bill(p_place_id uuid, p_consumer_id uuid, p_bill_cents integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  hash text;
begin
  update public.place_visit_codes vc
     set bill_confirmed_at = coalesce(vc.bill_confirmed_at, now()),
         expires_at = greatest(vc.expires_at, now() + public.place_visit_lease())
   where vc.place_id = p_place_id and vc.consumer_id = p_consumer_id and vc.expires_at > now()
     and vc.bill_cents = p_bill_cents
  returning vc.code_hash into hash;
  if hash is null then
    return jsonb_build_object('outcome', 'bill_changed');
  end if;
  return public.place_visit_state(p_place_id, hash);
end;
$$;

-- Task, staff's half: they saw the Story (it counts) or there is none (it does
-- not). Either settles the step.
create function public.place_visit_set_task(p_place_id uuid, p_code_hash text, p_place_code_hash text, p_seen boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  checked text;
begin
  checked := public.place_visit_staff_check(p_place_id, p_code_hash, p_place_code_hash);
  if checked <> 'ok' then
    return jsonb_build_object('outcome', checked);
  end if;
  update public.place_visit_codes vc
     set story = p_seen,
         task_seen_at = case when p_seen then now() end,
         task_skipped_at = case when p_seen then null else now() end,
         expires_at = greatest(vc.expires_at, now() + public.place_visit_lease())
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash and vc.expires_at > now();
  return public.place_visit_state(p_place_id, p_code_hash);
end;
$$;

-- Task, the guest's half: no story today. Staff's Seen it is not undone by it.
create function public.place_visit_skip_task(p_place_id uuid, p_consumer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  hash text;
begin
  update public.place_visit_codes vc
     set story = false,
         task_skipped_at = coalesce(vc.task_skipped_at, now())
   where vc.place_id = p_place_id and vc.consumer_id = p_consumer_id and vc.expires_at > now()
     and vc.task_seen_at is null
  returning vc.code_hash into hash;
  if hash is null then
    return public.place_visit_state_for_guest(p_place_id, p_consumer_id);
  end if;
  return public.place_visit_state(p_place_id, hash);
end;
$$;

-- Received: the close. The bill it logs is the one the guest confirmed; a bill
-- nobody confirmed, or one that changed since, is refused. Story counts only when
-- staff saw it (story is theirs now). The rest is MESITA-3240's: the place code,
-- the wrong-try lock, the replay on a retried tap.
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
  checked text;
  ticked boolean;
  confirmed_bill integer;
  confirmed_at timestamptz;
  visit public.place_visits;
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

  select vc.story, vc.bill_cents, vc.bill_confirmed_at
    into ticked, confirmed_bill, confirmed_at
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where vc.place_id = p_place_id and vc.code_hash = p_code_hash
     and vc.expires_at > now() and c.deleted_at is null
   for update of vc;
  if not found then
    return jsonb_build_object('outcome', 'bad_code');
  end if;

  checked := public.place_visit_staff_check(p_place_id, p_code_hash, p_place_code_hash);
  if checked <> 'ok' then
    return jsonb_build_object('outcome', checked);
  end if;

  if confirmed_at is null or confirmed_bill is distinct from p_bill_cents then
    return jsonb_build_object('outcome', 'bill_not_confirmed');
  end if;
  if 'instagram_story' = any(coalesce(p_reward_kinds, '{}')) and not ticked then
    return jsonb_build_object('outcome', 'not_eligible', 'reason', 'story_not_seen');
  end if;
  return public.place_visit_create(p_place_id, p_code_hash, p_bill_cents, null, p_reward_kinds, p_request_id, null);
end;
$$;

revoke all on function public.place_visit_lease() from public, anon, authenticated;
revoke all on function public.place_visit_quote(integer, jsonb) from public, anon, authenticated;
revoke all on function public.place_visit_state(uuid, text) from public, anon, authenticated;
revoke all on function public.place_visit_state_for_guest(uuid, uuid) from public, anon, authenticated;
revoke all on function public.place_visit_staff_check(uuid, text, text) from public, anon, authenticated;
revoke all on function public.place_visit_set_bill(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.place_visit_confirm_bill(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.place_visit_set_task(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.place_visit_skip_task(uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_visit_lease() to service_role;
grant execute on function public.place_visit_quote(integer, jsonb) to service_role;
grant execute on function public.place_visit_state(uuid, text) to service_role;
grant execute on function public.place_visit_state_for_guest(uuid, uuid) to service_role;
grant execute on function public.place_visit_staff_check(uuid, text, text) to service_role;
grant execute on function public.place_visit_set_bill(uuid, text, text, integer) to service_role;
grant execute on function public.place_visit_confirm_bill(uuid, uuid, integer) to service_role;
grant execute on function public.place_visit_set_task(uuid, text, text, boolean) to service_role;
grant execute on function public.place_visit_skip_task(uuid, uuid) to service_role;
