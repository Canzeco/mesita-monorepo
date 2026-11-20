-- MESITA-4139 — the monthly cap and the one-live-ticket rule close under one lock.
--
-- consumer-web-create-reservation counted, then inserted. Two tabs both read
-- "2 of 3" and both inserted. The same gap let two live tickets land at one
-- place. supabase-js has no transaction, so the count, the live check and the
-- insert are this function: one transaction, one advisory lock per guest.
--
-- A partial unique index on (consumer, place) where state is pending or
-- confirmed cannot express "the slot has not passed" (now() is not allowed
-- in an index predicate), and past meals stay confirmed. That index would
-- refuse every later booking at a place the guest has already eaten at.

create or replace function public.reservation_insert_capped(
  p_consumer_id uuid,
  p_place_id uuid,
  p_reference_code text,
  p_reserved_at timestamptz,
  p_party_size integer,
  p_notes text,
  p_consumer_notify text,
  p_confirm_notify text,
  p_guest_first_name text,
  p_guest_last_name text,
  p_request_id uuid,
  p_time_window_minutes integer,
  p_seating text,
  p_month_start timestamptz,
  p_cap integer,
  p_live_since timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  live_id uuid;
  n integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_consumer_id::text, 4139));

  if p_request_id is not null then
    select id into existing
    from public.reservation_tickets
    where consumer_id = p_consumer_id and request_id = p_request_id;
    if existing is not null then
      return jsonb_build_object('ok', true, 'replay', true, 'id', existing);
    end if;
  end if;

  select id into live_id
  from public.reservation_tickets
  where consumer_id = p_consumer_id
    and place_id = p_place_id
    and state in ('pending', 'confirmed')
    and reserved_at >= p_live_since
  limit 1;
  if live_id is not null then
    return jsonb_build_object('ok', false, 'code', 'already_reserved', 'reservation_id', live_id);
  end if;

  if p_cap is not null then
    select count(*) into n
    from public.reservation_tickets
    where consumer_id = p_consumer_id
      and is_test = false
      and created_at >= p_month_start
      and state not in ('cancelled', 'declined', 'unreachable', 'unresolved');
    if n >= p_cap then
      return jsonb_build_object('ok', false, 'code', 'reservation_limit_reached', 'limit', p_cap);
    end if;
  end if;

  begin
    insert into public.reservation_tickets (
      consumer_id, place_id, reference_code, reserved_at, party_size, notes,
      consumer_notify, confirm_notify, state, guest_first_name, guest_last_name,
      request_id, time_window_minutes, seating, attempts_state, next_attempt_at
    ) values (
      p_consumer_id, p_place_id, p_reference_code, p_reserved_at, p_party_size, p_notes,
      p_consumer_notify, p_confirm_notify, 'pending', p_guest_first_name, p_guest_last_name,
      p_request_id, p_time_window_minutes, p_seating, 'scheduled', now()
    )
    returning id into new_id;
  exception when unique_violation then
    if p_request_id is not null then
      select id into existing
      from public.reservation_tickets
      where consumer_id = p_consumer_id and request_id = p_request_id;
      if existing is not null then
        return jsonb_build_object('ok', true, 'replay', true, 'id', existing);
      end if;
    end if;
    return jsonb_build_object('ok', false, 'code', 'reference_taken');
  end;

  return jsonb_build_object('ok', true, 'replay', false, 'id', new_id);
end;
$$;

revoke all on function public.reservation_insert_capped(
  uuid, uuid, text, timestamptz, integer, text, text, text, text, text, uuid, integer, text, timestamptz, integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.reservation_insert_capped(
  uuid, uuid, text, timestamptz, integer, text, text, text, text, text, uuid, integer, text, timestamptz, integer, timestamptz
) to service_role;

comment on function public.reservation_insert_capped(
  uuid, uuid, text, timestamptz, integer, text, text, text, text, text, uuid, integer, text, timestamptz, integer, timestamptz
) is
  'MESITA-4139: one guest lock, then the monthly cap, the live ticket at this place, and the insert. p_cap null lifts the cap. Service role only.';
