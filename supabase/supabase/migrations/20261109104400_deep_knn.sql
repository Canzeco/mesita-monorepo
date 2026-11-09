-- MESITA-2330: the Deep pipeline's kNN runs in Postgres, with no pool cap.
--
-- Until now deepDepsFor fetched the first 300 active, ready places with a
-- summary vector (ordered by id) and ran the cosine in TypeScript. Past 300
-- ready places the cut fell by id, so a place that matched the guest's
-- description could be missing only because its id sorted late.
--
-- This function orders EVERY gated place by cosine distance to the query
-- vector and returns the nearest p_limit. The gates are the ones the pool
-- query pushed down: state active, content ready, a summary vector, and
-- business_state OPERATIONAL when Discovery › General's requireActive is on.
-- Deep's similarity floor rides the WHERE clause too (0 = no floor), so a
-- floored place never takes a slot.
--
-- The scoring contract stays in TypeScript: descriptionSimilarity
-- (pipeline-signals.ts) re-scores the returned vectors and the pipeline
-- re-sorts. SQL only chooses which k rows come back. The order is exact: the
-- profiles view joins places to place_profiles, so the planner sorts every
-- gated row by distance rather than reading the approximate HNSW index.
--
-- The query vector arrives as pgvector's text form ('[0.1, …]'); a vector
-- whose dimension differs from a stored one (a model change) skips that row
-- instead of raising.
--
-- Read-only. Service role only: consumer-web-ask-memo (through
-- deep-pipeline.ts) is its one caller.

create or replace function public.deep_knn(
  p_query text,
  p_limit integer,
  p_min_similarity double precision,
  p_require_active boolean
)
 returns table (
  id uuid,
  slug text,
  name text,
  address text,
  family_keys text[],
  google_stars_overall double precision,
  google_review_count integer,
  description text,
  embedding text
 )
 language sql
 stable
 security invoker
 set search_path to 'public', 'extensions'
as $function$
  with q as (select p_query::extensions.vector as v)
  select p.id,
         p.slug,
         p.name,
         p.address,
         p.family_keys,
         p.google_stars_overall::double precision,
         p.google_review_count,
         p.description,
         p.embedding::text
    from public.profiles p, q
   where p.state = 'active'
     and p.content_state = 'ready'
     and p.embedding is not null
     and extensions.vector_dims(p.embedding) = extensions.vector_dims(q.v)
     and (not coalesce(p_require_active, false) or p.business_state = 'OPERATIONAL')
     and (coalesce(p_min_similarity, 0) <= 0
          or 1 - (p.embedding operator(extensions.<=>) q.v) >= p_min_similarity)
   order by p.embedding operator(extensions.<=>) q.v asc,
            p.name asc,
            p.id asc
   limit greatest(1, least(coalesce(p_limit, 5), 100));
$function$;

comment on function public.deep_knn(text, integer, double precision, boolean) is
  'MESITA-2330: the Deep pipeline''s kNN — every active, ready place with a summary vector, nearest first by cosine distance, gated by General''s requireActive and Deep''s similarity floor. No pool cap. Service role only (consumer-web-ask-memo).';

revoke all on function public.deep_knn(text, integer, double precision, boolean) from public, anon, authenticated;
grant execute on function public.deep_knn(text, integer, double precision, boolean) to service_role;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'deep_knn') then
    raise exception 'deep_knn is missing after apply';
  end if;
end $$;
