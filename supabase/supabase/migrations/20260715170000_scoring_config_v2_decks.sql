-- Scoring Config blob v2 — scoring v9 (MESITA-620).
--
-- Comment-only. The model went single-tier and deck-first:
--
--   4 Lanes       ON · OF · IN · IF     organic|inorganic × now|future
--   4 Scores      one per Lane          ON = ES×GP×WW · OF = ES×GP ·
--                                       IN = ES×RP×WW · IF = ES×RP
--   4 Sub-Scores  es · gp · rp · ww     ES Embeddings Similarity (0-100)
--                                       GP Google Popularity (smooth
--                                          volume × quality, 0-1)
--                                       RP Rewards Promotions (0-3)
--                                       WW Where When (0-1)
--
-- vs the v1 blob (MESITA-619): SM (the LLM judge) and the Fast/Slow tier
-- pair are DELETED (everything embeddings-based); the daypart WHAT term left
-- WW; GP is NEW (earned popularity, the organic lanes' multiplier); the
-- percent engine mix became DECKS — absolute cards per lane per engine.
-- Renamed/reshaped WITHOUT a data migration or a compat shim because
-- scoring_config was verified NULL in prod — no override had ever been
-- saved, so there is no legacy blob to carry.

comment on column public.app_settings.scoring_config is
  'Scoring model hyperparameters, one versioned blob: { v: 2, decks, retrieval, es, gp, rp, ww, context } — keys follow the Sub-Score names (see web-admin lib/business/scores.ts). NULL = following code defaults. Written by admin-web-update-scoring-config.';
