-- scoring_config DB default (MESITA-737).
--
-- Only whole-blob config without a column default — NULL was a normal state
-- that admin lineup-config silently coerced to code defaults, so a failed
-- GET + Save could wipe the live singleton. Mirror siblings (rewards /
-- sourcing / reservations / memo): locked defaults on the column, backfill
-- NULL rows, NOT NULL.
--
-- Blob shape = DEFAULT_SCORING_SETTINGS v12
-- (supabase/functions/_shared/lineup-scoring.ts · web-admin lib/business/scores.ts).

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
    "aggressive": 0.7,
    "dominant": 1.0
  },
  "xx": { "control": 1 }
}
$scoring$::jsonb;

update public.app_settings
  set scoring_config = default
  where scoring_config is null;

alter table public.app_settings
  alter column scoring_config set not null;

comment on column public.app_settings.scoring_config is
  'Lineup Config hyperparameters (v12: laneN/sm/gp/rp/xx). NOT NULL with locked defaults. Written by admin-web-update-lineup-config.';
