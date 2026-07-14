-- Scoring Config settings blob (admin /scoring-config/params → Save).
--
-- One versioned jsonb: { v, mix, retrieval, ww, promos } — the scoring
-- model's hyperparameters (engine lane mix, RIPD/LIPD retrieval knobs, WW
-- curve knobs, promo rungs). NULL means "following code defaults"
-- (DEFAULT_SCORING_SETTINGS in web-admin lib/business/scores.ts), so default
-- improvements propagate until an operator saves an override.
--
-- Read/written ONLY via admin-web-get-scoring-config /
-- admin-web-update-scoring-config (super-admin gated). The model itself is
-- still a frontend draft — nothing in Swipe/Map/Memo reads this yet; when the
-- engines go live this blob is their config source.

alter table public.app_settings
  add column if not exists scoring_config jsonb;

comment on column public.app_settings.scoring_config is
  'Scoring model hyperparameters (v1: mix/retrieval/ww/promos). NULL = code defaults. Written by admin-web-update-scoring-config.';
