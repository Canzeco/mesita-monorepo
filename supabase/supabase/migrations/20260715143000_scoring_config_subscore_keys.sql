-- Scoring Config blob — document the Sub-Score key names (MESITA-619).
--
-- Comment-only. The blob's keys now follow the four Sub-Score names, so the
-- storage can never drift from what the console calls them:
--
--   4 Lanes       ON · OF · IN · IF     organic|inorganic × now|future
--   4 Scores      one per Lane          ON/OF/IN/IF Score
--   4 Sub-Scores  fm · sm · www · bp    FM Fast-Match (embeddings)
--                                       SM Slow-Match (LLM judge)
--                                       WWW the moment (what × where × when)
--                                       BP Business Promo (rates → posture)
--
-- Renamed from the pre-MESITA-619 shape: ripm → fm, lipm → sm, promos → bp,
-- context.{ripm,lipm} → context.{fm,sm}. Done WITHOUT a data migration or a
-- compat shim because scoring_config was verified NULL in prod — no override
-- had ever been saved, so there is no legacy blob to carry. (The same fact
-- retired the older `ww` → `www` fallback, which could never fire.)
--
-- The 20260714224239 comment this replaces was already stale: it documented
-- `ww` (superseded by `www` in v7.4, when WHAT returned) and predated the
-- context / fm / sm keys entirely.

comment on column public.app_settings.scoring_config is
  'Scoring model hyperparameters, one versioned blob: { v, mix, retrieval, www, bp, context, fm, sm } — keys follow the Sub-Score names (see web-admin lib/business/scores.ts). NULL = following code defaults. Written by admin-web-update-scoring-config.';
