-- MESITA-2804. A Render run that dies before its catch (instance killed, OOM,
-- deploy mid-run) never sends its stop, so the place stays enriching
-- (places.content_state = 'generating') forever: the consumer shows Enriching,
-- and Google refetch, admin Google edits and a guest's claimed start all refuse
-- the place because it is "already enriching".
--
-- The sweep puts such a place back where a refused start would leave it
-- (contentStateAfterRefusal in functions/_shared/enrich-start.ts): ready when
-- it was enriched before (place_profiles.enriched_at set), failed when never.
--
-- "Stuck since" is places.updated_at: the claim that set 'generating' is an
-- update, places_set_updated_at stamps it, and nothing else writes the places
-- row while a run is in flight (an admin edit only pushes the sweep later,
-- the safe direction).
--
-- decision: the bound is 6 hours. One place measures ~150s wall clock
-- (Socials ~66s of a ~93s research stage), call it 5 min worst case. A
-- 50-place run (ENRICH_MAX_PLACES) goes in waves of 2 (render AT_ONCE), so its
-- last place can sit 'generating' for 25 waves x ~5 min ~= 2h before its turn.
-- 6h is 3x that, so a live run is never swept from under itself, while a dead
-- one clears the same day. Hourly is often enough at that bound.

create or replace function public.unstick_enriching_places(
  older_than interval default interval '6 hours'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  update public.places p
     set content_state = case
           when pp.enriched_at is not null then 'ready'::public.content_state
           else 'failed'::public.content_state
         end
    from public.places src
    left join public.place_profiles pp on pp.id = src.id
   where p.id = src.id
     and p.content_state = 'generating'
     and p.updated_at < now() - older_than;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    raise log 'unstick_enriching_places: % place(s) left enriching longer than % were reset', v_n, older_than;
  end if;
  return v_n;
end;
$$;

revoke execute on function public.unstick_enriching_places(interval) from public, anon, authenticated;

select cron.unschedule('unstick-enriching-places')
where exists (select 1 from cron.job where jobname = 'unstick-enriching-places');
select cron.schedule(
  'unstick-enriching-places',
  '41 * * * *',
  $cron$ select public.unstick_enriching_places(); $cron$
);
