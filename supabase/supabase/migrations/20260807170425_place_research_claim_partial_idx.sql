-- MESITA-942: narrow the enricher claim index to live rows only.
-- The full (stage, status, updated_at) index covers done/failed history
-- that the poller never reads.

drop index if exists public.place_research_stage_status_idx;

create index place_research_stage_status_idx
  on public.place_research (stage, updated_at)
  where status in ('pending', 'running');

comment on index public.place_research_stage_status_idx is
  'Enricher claim queue — pending|running only (MESITA-942).';
