-- MESITA-2641: the Presentation was cut mid-word.
--
-- Every writer of place_profiles.description capped it with a raw
-- .slice(0, 500) (ENRICH_FIELD_LIMITS.description, MESITA-2248), so 44 of the
-- 53 stored presentations were exactly 500 characters and ended mid-word
-- ("...with family o"). The writers now cut at the last full sentence
-- (_shared/presentation-cap.ts, render/src/google-spine.ts). This repairs the
-- rows already stored: a description of exactly 500 characters that does not
-- end in terminal punctuation is trimmed to its last sentence end.
--
-- Dry run on live (2026-10-22): all 44 rows land on a clean sentence end,
-- the shortest at 344 characters. A row whose last sentence end sits in the
-- first 40% (one giant sentence) is left alone rather than gutted.
-- Idempotent: a repaired row is under 500 characters and ends in
-- punctuation, so a re-run matches nothing.

update public.place_profiles
set description = rtrim(substring(description from '^(.*[.!?])'))
where length(description) = 500
  and description !~ '[.!?…)"”]\s*$'
  and length(rtrim(substring(description from '^(.*[.!?])'))) >= 200;
