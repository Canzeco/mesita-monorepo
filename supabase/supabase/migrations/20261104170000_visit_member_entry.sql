-- MESITA-3262 — when the QR won't scan (Pato, 2026-11-04: "if not scan, enable to
-- manually input member number"). Staff type the member number and the place's six
-- digits together. The member number alone opens nothing: member numbers are
-- sequential and visit.mesita.ai has no sign-in, so alone it would read any guest's
-- name and bill. The guest must also have an open QR at the place whose code matched.

-- Its own counter, per guest. place_code_tries stays as it is: a stranger typing a
-- sequential number can lock this door for a guest, but never their scanned QR.
create table public.visit_member_tries (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  wrong integer not null default 0,
  locked_until timestamptz
);

comment on table public.visit_member_tries is
  'MESITA-3262: wrong member number + place code tries for a guest at visit.mesita.ai. Five lock typing that guest in for 15 minutes; scanning still works. EF-only.';

alter table public.visit_member_tries enable row level security;
revoke all on table public.visit_member_tries from public, anon, authenticated;
grant all on table public.visit_member_tries to service_role;

-- Where this guest has an open QR. The Edge Function needs the places to hash the
-- typed digits for each, because a place code's hash is bound to its place. Never
-- returned to the page.
create function public.place_visit_member_places(p_member_number text)
returns uuid[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(vc.place_id), '{}'::uuid[])
    from public.place_visit_codes vc
    join public.consumers c on c.id = vc.consumer_id
   where c.code = p_member_number and c.deleted_at is null and vc.expires_at > now();
$$;

-- p_candidates: [{ place_id, place_code_hash, new_code_hash }], one per place above.
-- A match swaps that open code's secret for a new one the page can hold, keeping its
-- bill, Story tick and end time, so the rest is the normal visit. The scanned link
-- stops working then; the guest's screen asks by place and time, not by code.
-- Unknown member, no open QR and wrong digits all answer no_match.
create function public.place_visit_member_claim(p_member_number text, p_candidates jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  guest_id uuid;
  lock_ends timestamptz;
  wrong_now integer;
  matched_place uuid;
  new_hash text;
begin
  select c.id into guest_id from public.consumers c
   where c.code = p_member_number and c.deleted_at is null;
  if not found then
    return jsonb_build_object('outcome', 'no_match');
  end if;

  select t.locked_until into lock_ends from public.visit_member_tries t where t.consumer_id = guest_id;
  if lock_ends > now() then
    return jsonb_build_object('outcome', 'locked');
  end if;

  select vc.place_id, e.item->>'new_code_hash' into matched_place, new_hash
    from jsonb_array_elements(p_candidates) as e(item)
    join public.place_visit_codes vc
      on vc.place_id = (e.item->>'place_id')::uuid and vc.consumer_id = guest_id and vc.expires_at > now()
    join public.place_rewards r
      on r.place_id = vc.place_id and r.place_code_hash = e.item->>'place_code_hash'
   limit 1
   for update of vc;

  if matched_place is null then
    insert into public.visit_member_tries as t (consumer_id, wrong)
    values (guest_id, 1)
    on conflict (consumer_id) do update set wrong = t.wrong + 1, locked_until = null
    returning t.wrong into wrong_now;
    if wrong_now >= 5 then
      update public.visit_member_tries t
         set wrong = 0, locked_until = now() + interval '15 minutes'
       where t.consumer_id = guest_id;
      return jsonb_build_object('outcome', 'locked');
    end if;
    return jsonb_build_object('outcome', 'no_match');
  end if;

  delete from public.visit_member_tries t where t.consumer_id = guest_id;
  update public.place_visit_codes vc
     set code_hash = new_hash
   where vc.place_id = matched_place and vc.consumer_id = guest_id;
  return jsonb_build_object('outcome', 'ok', 'place_id', matched_place);
end;
$$;

revoke all on function public.place_visit_member_places(text) from public, anon, authenticated;
revoke all on function public.place_visit_member_claim(text, jsonb) from public, anon, authenticated;
grant execute on function public.place_visit_member_places(text) to service_role;
grant execute on function public.place_visit_member_claim(text, jsonb) to service_role;
