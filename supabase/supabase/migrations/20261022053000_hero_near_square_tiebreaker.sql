-- MESITA-2656 (Pato, 2026-10-21): the hero photo should be close to square,
-- "only a small detail … not the primary criteria neither the secondary".
-- One sentence joins the live image-sorting prompt, after its hero rule
-- (or at the end if an operator rewrote that rule). Idempotent.
update public.app_config
set enrichment_config = jsonb_set(
  enrichment_config,
  '{atlasImageSortingPrompt}',
  to_jsonb(
    case
      when position('should never be the lead image.' in enrichment_config->>'atlasImageSortingPrompt') > 0
        then replace(
          enrichment_config->>'atlasImageSortingPrompt',
          'should never be the lead image.',
          'should never be the lead image. As a minor tie-breaker only (never a primary or secondary criterion), prefer a hero whose shape is close to square over a strongly horizontal or vertical one, because the app shows it in a square tile.'
        )
      else (enrichment_config->>'atlasImageSortingPrompt')
        || ' As a minor tie-breaker only (never a primary or secondary criterion), prefer a hero whose shape is close to square over a strongly horizontal or vertical one, because the app shows it in a square tile.'
    end
  )
)
where id = 1
  and enrichment_config ? 'atlasImageSortingPrompt'
  and position('close to square' in enrichment_config->>'atlasImageSortingPrompt') = 0;
