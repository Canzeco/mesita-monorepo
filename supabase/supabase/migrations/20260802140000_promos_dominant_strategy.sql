-- Promos: restore the Dominant strategy as the fourth grid column.
--
-- Dominant was a v4 preset, retired in v5 (#474) when the grid moved onto
-- app_settings.rewards_config with three columns (Zero / Conservative /
-- Aggressive). Its v4 rate tuple never actually left the codebase —
-- _shared/lineup-strategy.ts still matched it, and _shared/rewards-config.ts
-- coerced those places to `aggressive`, silently underpaying the strongest
-- posture a business can take. This restores it end to end: the grid gets a
-- `dominant` cell per segment, and placeStrategy stops coercing.
--
-- Values follow the invariant Dominant always had — it raises the FLOOR, not
-- the ceiling. Every rung climbs one step over Aggressive except Google
-- Review, which is already at the platform ceiling (50%) and stays there.
-- Grid rule is unchanged: 5% steps, floor 10%, ceiling 50%, 0 = off; the Zero
-- column is off by definition.
--
--   Segment            zero  cons  aggr  domi
--   standard             0    10    10    20
--   premium              0    15    20    25
--   influencer           0    15    20    25
--   aura                 0    20    25    30
--   story                0    20    30    40
--   welcome              0    20    30    40
--   review               0    30    50    50   (ceiling — unchanged)

-- 1) Add the dominant cell to every segment of the live row. Merge per key so
--    an operator's tuned conservative/aggressive values are preserved.
update public.app_settings
set rewards_config = jsonb_set(
  rewards_config,
  '{grid}',
  (
    select jsonb_object_agg(
      seg.key,
      (rewards_config->'grid'->seg.key) || jsonb_build_object('dominant', seg.dominant)
    )
    from (values
      ('standard',   20),
      ('premium',    25),
      ('influencer', 25),
      ('aura',       30),
      ('story',      40),
      ('welcome',    40),
      ('review',     50)
    ) as seg(key, dominant)
    where rewards_config->'grid' ? seg.key
  )
)
where id = 1
  and rewards_config ? 'grid';

-- 2) Update the column DEFAULT so a fresh environment seeds the four-column
--    shape (the 20260801120000 default is still three-column).
alter table public.app_settings
  alter column rewards_config set default $rewards$
{
  "cap": 500,
  "grid": {
    "standard":   { "zero": 0, "conservative": 10, "aggressive": 10, "dominant": 20 },
    "premium":    { "zero": 0, "conservative": 15, "aggressive": 20, "dominant": 25 },
    "influencer": { "zero": 0, "conservative": 15, "aggressive": 20, "dominant": 25 },
    "aura":       { "zero": 0, "conservative": 20, "aggressive": 25, "dominant": 30 },
    "story":      { "zero": 0, "conservative": 20, "aggressive": 30, "dominant": 40 },
    "welcome":    { "zero": 0, "conservative": 20, "aggressive": 30, "dominant": 40 },
    "review":     { "zero": 0, "conservative": 30, "aggressive": 50, "dominant": 50 }
  }
}
$rewards$::jsonb;

-- 3) The Lineup RP rung for the dominant strategy. admin-web-update-scoring-config
--    has ALWAYS required rp.dominant (its STRATEGY_IDS kept the fourth key), and
--    _shared/lineup-scoring.ts defaults it to 1.0 — but the admin Lineup Config
--    page only ever sent three, so the RP section could not save. Seed the key so
--    the stored blob matches the validator.
update public.app_settings
set scoring_config = jsonb_set(
  scoring_config,
  '{rp,dominant}',
  to_jsonb(1.0::numeric)
)
where id = 1
  and scoring_config ? 'rp'
  and not (scoring_config->'rp' ? 'dominant');
