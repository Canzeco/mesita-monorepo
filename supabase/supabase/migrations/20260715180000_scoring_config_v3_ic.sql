-- Scoring Config blob v3 — scoring v9.1 (MESITA-621).
--
-- Comment-only. Two corrections to v9 (same day):
--   · Subscore rename WW → IC (Intent Context) — same knobs, same
--     where × when factors; blob key `ww` → `ic`.
--   · Deck composition counts became per-lane MAXES: each lane fills its own
--     SUB-DECK independently, the sub-decks merge into one deck removing
--     repeated places (paid copy wins), and nothing backfills — the deck is
--     usually smaller than the sum of its maxes, by design.
-- Hierarchy: subscores → scores → cards → sub-decks → decks
-- (Swipe · Map · Pre-Memo — Memo's deck is its retrieval set).
-- Reshaped WITHOUT a data migration or compat shim: scoring_config verified
-- NULL in prod (restored after MESITA-620's round-trip test).

comment on column public.app_settings.scoring_config is
  'Scoring model hyperparameters, one versioned blob: { v: 3, decks (per-lane maxes), retrieval, es, gp, rp, ic, context } — keys follow the Subscore names (see web-admin lib/business/scores.ts). NULL = following code defaults. Written by admin-web-update-scoring-config.';
