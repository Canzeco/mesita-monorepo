-- MESITA-3090: Multiple Places › Edit sets Premier in bulk (Premier 2X,
-- Premier 5X, End Premier). One call per place, through
-- admin-web-grant-place-premier action "set".
--
-- premier_set_grant moves a place to the asked tier in ONE transaction:
-- it ends the running operator grant (premier_end_grant) and, for tier 1|2,
-- grants a fresh one (premier_grant), under the same per-place advisory
-- lock both take. An EF-side end-then-grant could leave a place Free when
-- the grant half fails; one transaction cannot.
--
-- Order: validate → lock → place exists → archived → a guest pays →
-- guests are waiting to pay → a guest is checking out → end the running
-- grant → grant (tier 1|2).
--
-- The box never starts, holds or ends a guest charge, so it refuses:
--   a guest pays          any running paid/charging period that is not an
--                         operator grant (keyed on granted_by, so a guest
--                         period whose pledge link was nulled still counts);
--   guests waiting        a ready pledge with a saved card — ending a grant
--                         would let the renewal charge it within 5 minutes
--                         (renewal predicate, 20261029030000_premier_line.sql);
--   a guest checking out  an open pledge whose Checkout was touched in the
--                         last 31 minutes (CHECKOUT_TTL_SEC) — any change to
--                         the running period makes premier_claim call the
--                         quote stale and cancel the guest's held payment.
--
-- Returns jsonb { result: granted | ended | already, ends_at,
--                 previous_tier, previous_ends_at }.

create or replace function public.premier_set_grant(
  p_place_id uuid,
  p_tier smallint,
  p_months integer,
  p_by text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_state text;
  v_prev_tier smallint;
  v_prev_ends timestamptz;
  v_id uuid;
  v_ends timestamptz;
begin
  if p_tier is null or p_tier not between 0 and 2 then
    raise exception 'premier_set_grant: tier must be 0, 1 or 2, got %', p_tier using errcode = 'P0001';
  end if;
  if p_tier > 0 and (p_months is null or p_months not between 1 and 12) then
    raise exception 'premier_set_grant: months must be 1..12, got %', p_months using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_place_id::text));

  select state into v_state from public.places where id = p_place_id;
  if not found then
    raise exception 'premier_set_grant: no such place' using errcode = 'P0001';
  end if;
  if v_state = 'archived' then
    raise exception 'premier_set_grant: archived' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = p_place_id and status in ('paid', 'charging') and ends_at > now()
                and not (status = 'paid' and backing_id is null and granted_by is not null)) then
    raise exception 'premier_set_grant: a guest pays' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.place_backings
              where place_id = p_place_id and status = 'ready' and stripe_payment_method_id is not null) then
    raise exception 'premier_set_grant: guests are waiting to pay' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.place_backings
              where place_id = p_place_id and status = 'open' and stripe_checkout_session_id is not null
                and updated_at > now() - interval '31 minutes') then
    raise exception 'premier_set_grant: a guest is checking out' using errcode = 'P0001';
  end if;

  select tier, ends_at into v_prev_tier, v_prev_ends
    from public.place_premier_periods
   where place_id = p_place_id and status = 'paid' and backing_id is null
     and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1;
  if v_prev_tier is not null then
    perform public.premier_end_grant(p_place_id);
  end if;

  if p_tier = 0 then
    return jsonb_build_object(
      'result', case when v_prev_tier is null then 'already' else 'ended' end,
      'ends_at', null,
      'previous_tier', v_prev_tier,
      'previous_ends_at', v_prev_ends);
  end if;

  v_id := public.premier_grant(p_place_id, p_tier, p_months, p_by);
  select ends_at into v_ends from public.place_premier_periods where id = v_id;
  return jsonb_build_object(
    'result', 'granted',
    'ends_at', v_ends,
    'previous_tier', v_prev_tier,
    'previous_ends_at', v_prev_ends);
end;
$function$;

revoke all on function public.premier_set_grant(uuid, smallint, integer, text) from public;
revoke execute on function public.premier_set_grant(uuid, smallint, integer, text) from anon, authenticated;
grant execute on function public.premier_set_grant(uuid, smallint, integer, text) to service_role;
