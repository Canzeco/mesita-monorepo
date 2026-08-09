-- scoring_config column DEFAULT: retire Dominant; Aggressive = peak (1.0).
--
-- 20260805163237 locked a v12-shaped DEFAULT that still carried
-- rp.dominant + aggressive=0.7. 20260809140000 rewrote the live singleton
-- row's rp block, but left the column DEFAULT stale — so future inserts /
-- `set scoring_config = default` would re-seed the retired four-rung shape.
--
-- DEFAULT-only: the live app_settings row is already on the three-rung rp
-- (zero / conservative / aggressive=1.0) from 20260809140000. Do not clobber
-- a customized live blob.

alter table public.app_settings
  alter column scoring_config set default $scoring$
{
  "v": 12,
  "laneN": { "organic": 8, "inorganic": 8 },
  "sm": {
    "where": { "defaultTolKm": 5 },
    "when": { "patience": 0.35 },
    "what": { "tol": 0.5 }
  },
  "gp": { "lnCeiling": 10, "ratingPow": 1 },
  "rp": {
    "zero": 0.1,
    "conservative": 0.4,
    "aggressive": 1.0
  },
  "xx": { "control": 1 }
}
$scoring$::jsonb;

comment on column public.app_settings.scoring_config is
  'Lineup Config hyperparameters (v12: laneN/sm/gp/rp/xx). NOT NULL with locked defaults (rp: zero/conservative/aggressive; no dominant). Written by admin-web-update-lineup-config.';
