-- MESITA-2337 — the Discovery blob keeps only what a reader reads.
--
-- consumer-web-list-places' listed lanes were the last readers of
-- `discovery_config.filters`, and they retired with this change. The Swipe
-- deck (MESITA-2328) and the pipeline rework (MESITA-2327) had already left
-- `weights`, `weightsByMode`, `engines`, `swipe`, `catalog.ranking` and the
-- deck's numbers on `params` with no reader. Both normalizers drop them on
-- the next Save; this strips the stored copy now, so the live row matches the
-- code without waiting for an operator to press Save.
--
-- `params` keeps exactly what `normalizeSignalParams` reads, the Area
-- calibration (`proximity.halfDistanceKm`, `popularity.referenceRating`,
-- `popularity.referenceReviews`), and goes when none of it is stored, so the
-- code default applies. No SQL function reads discovery_config.

with src as (
  select id,
         (discovery_config - 'filters' - 'swipe' - 'engines' - 'weights'
            - 'weightsByMode' - 'params') #- '{catalog,ranking}' as kept,
         jsonb_strip_nulls(jsonb_build_object(
           'proximity', nullif(jsonb_strip_nulls(jsonb_build_object(
             'halfDistanceKm', discovery_config #> '{params,proximity,halfDistanceKm}'
           )), '{}'::jsonb),
           'popularity', nullif(jsonb_strip_nulls(jsonb_build_object(
             'referenceRating', discovery_config #> '{params,popularity,referenceRating}',
             'referenceReviews', discovery_config #> '{params,popularity,referenceReviews}'
           )), '{}'::jsonb)
         )) as params
    from public.app_config
   where id = 1
)
update public.app_config c
   set discovery_config = case
         when src.params = '{}'::jsonb then src.kept
         else src.kept || jsonb_build_object('params', src.params)
       end
  from src
 where c.id = src.id;

-- A fresh row starts empty: the code supplies every default. The old default
-- seeded `filters` and `engines`.
alter table public.app_config
  alter column discovery_config set default '{}'::jsonb;

comment on column public.app_config.discovery_config is
  'Discovery, the operator half: params (the Area calibration) · general · catalog · map · name · deep · chat. Keys are code-defined in functions/_shared/discovery-config.ts (normalizeDiscoveryConfig), read and written only through the discovery section of admin-web-get-config / admin-web-update-config. See Notion Docs > Discovery.';

do $postflight$
begin
  if exists (
    select 1
      from public.app_config
     where id = 1
       and (
         discovery_config ?| array['filters', 'swipe', 'engines', 'weights', 'weightsByMode']
         or discovery_config #> '{catalog,ranking}' is not null
         or (coalesce(discovery_config -> 'params', '{}'::jsonb)
               - 'proximity' - 'popularity') <> '{}'::jsonb
       )
  ) then
    raise exception 'a retired discovery_config key survived';
  end if;
end $postflight$;
