-- MESITA-4238 — the re-pick's one write door for Mesita Families.
--
-- `admin-web-repick-families` re-runs the families part of the Description
-- prompt on live places and writes the result here, never through PostgREST:
-- supabase-js has no multi-statement transaction, and the write and its undo
-- record must land together.
--
-- In one transaction it writes `family_keys` only when
--   * the stored list is still exactly what the caller read (`is not distinct
--     from`, so a null list compares too),
--   * no Enrich is in flight (`places.content_state <> 'generating'`), and
--   * an operator has not taken the field (`enrichment_sources.operator_fields`
--     is an array holding `family_keys`; any other shape is not owned, the same
--     reading as `readOperatorFields`),
-- and then records one `admin_operator_events` row whose detail carries the old
-- and new lists, so any run can be reverted (Docs › Atlas holds the statement).
--
-- It answers what happened: written | owned | generating | stale | missing.
-- It never writes null or an empty list: hiding a place is not its job.

create or replace function public.admin_repick_family_keys(
  p_place uuid,
  p_before text[],
  p_after text[],
  p_run_id text,
  p_actor uuid,
  p_source text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text[];
  v_sources jsonb;
  v_state public.content_state;
begin
  if p_source is null or p_source not in ('repick-families', 'repick-families-agent') then
    raise exception 'admin_repick_family_keys: unknown source %', p_source using errcode = '22023';
  end if;
  if p_after is null or cardinality(p_after) = 0 then
    raise exception 'admin_repick_family_keys: after must be a non-empty list' using errcode = '22023';
  end if;
  if p_run_id is null or btrim(p_run_id) = '' then
    raise exception 'admin_repick_family_keys: run_id is required' using errcode = '22023';
  end if;

  select pp.family_keys, pp.enrichment_sources, p.content_state
    into v_current, v_sources, v_state
    from public.place_profiles pp
    join public.places p on p.id = pp.id
   where pp.id = p_place
     for update of pp;
  if not found then
    return 'missing';
  end if;

  if jsonb_typeof(v_sources -> 'operator_fields') = 'array'
     and (v_sources -> 'operator_fields') ? 'family_keys' then
    return 'owned';
  end if;
  if v_state = 'generating' then
    return 'generating';
  end if;
  if v_current is distinct from p_before then
    return 'stale';
  end if;

  update public.place_profiles set family_keys = p_after where id = p_place;

  insert into public.admin_operator_events (verb, outcome, place_id, actor_user_id, source, detail)
  values (
    'edit', 'succeeded', p_place, p_actor, p_source,
    jsonb_build_object('run_id', p_run_id, 'before', to_jsonb(p_before), 'after', to_jsonb(p_after))
  );

  return 'written';
end;
$$;

revoke all on function public.admin_repick_family_keys(uuid, text[], text[], text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_repick_family_keys(uuid, text[], text[], text, uuid, text)
  to service_role;
