-- Reach thresholds for the class ladder (decision: Pato, MESITA-1125).
--
-- New spec, in Classes v2 names:
--   Bronze   none      every account starts here
--   Silver   1,000     was 2,000
--   Gold     5,000     NOT APPLIED — see below
--   Diamond  20,000    was invitation-only (threshold null)
--
-- `classes` still stores the LEGACY keys, bridged client-side by
-- identityForClassKey: standard→Bronze, influencer→Silver, aura→Diamond.
-- `premium` is a PLAN sitting in the class table and keeps threshold null.
--
-- The grant engine is generic (_shared/class-doors.ts pickEffectiveClass takes
-- every row with a non-null follower_threshold, sorts by rank desc, and picks
-- the highest one the count clears), so these are pure data — no EF change.
--
-- GOLD IS DELIBERATELY ABSENT. There is no gold row: `rank` is UNIQUE and
-- rank 2 is held by `premium`, so seating Gold between Silver (1) and Diamond
-- (3) means re-ranking the live table, which changes every consumer's
-- effective class. That is MESITA-1076's job, not this migration's. Until it
-- lands the consumer app shows Gold's 5,000 bar but nothing grants it — the
-- same gap Gold has had since Classes v2 shipped, now with a number on it.
--
-- Diamond keeps its invitation door: pickEffectiveClass resolves invitation
-- independently of reach, so 20,000 followers is an ADDITIONAL way in, not a
-- replacement for the Aura list.

update public.classes set follower_threshold = 1000  where key = 'influencer';
update public.classes set follower_threshold = 20000 where key = 'aura';
