-- MESITA-3245 — the guest enters the bill (Pato, 2026-11-04: "guest enters bill,
-- then busienss just correct if wrong"). The bill waits with the QR's code until
-- the place closes the visit, and what the place confirms is what gets logged.
--
-- Nullable, and p_bill_cents defaults to null: the deployed function calls the old
-- four arguments until the integration redeploys it, minutes after this runs.

alter table public.place_visit_codes
  add column bill_cents integer check (bill_cents between 1 and 100000000);

comment on column public.place_visit_codes.bill_cents is
  'MESITA-3245: the bill as the guest typed it. The place may correct it when it closes the visit.';

drop function public.place_visit_code_issue(uuid, uuid, text, timestamptz);

create function public.place_visit_code_issue(
  p_place_id uuid, p_consumer_id uuid, p_code_hash text, p_expires_at timestamptz, p_bill_cents integer default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.place_visit_codes c
   where c.place_id = p_place_id and (c.consumer_id = p_consumer_id or c.expires_at <= now());
  insert into public.place_visit_codes (place_id, code_hash, consumer_id, expires_at, bill_cents)
  values (p_place_id, p_code_hash, p_consumer_id, p_expires_at, p_bill_cents)
  on conflict do nothing;
  return found;
end;
$$;

create or replace function public.place_visit_open(p_place_id uuid, p_code_hash text)
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
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.place_visit_code_issue(uuid, uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.place_visit_code_issue(uuid, uuid, text, timestamptz, integer) to service_role;
