-- MESITA-3247. Sync now sets instagram_found and facebook_found. Until now an
-- Enrich set them only from the Google spine, when Google itself listed the
-- link and before anything checked it, so places with real follower counts
-- read "did not resolve" and places whose check timed out read found.
--
-- One pass, so existing rows read what Sync would have left: found means a
-- saved link and a stored count. A stored count is proof a profile came back;
-- a link whose only check failed has none. The rule of the 20261013223000
-- backfill. No schema change.

update public.place_profiles
set
  instagram_found = nullif(btrim(instagram_url), '') is not null
    and instagram_followers_count is not null,
  facebook_found = nullif(btrim(facebook_url), '') is not null
    and facebook_followers is not null
where instagram_found is distinct from (
    nullif(btrim(instagram_url), '') is not null
    and instagram_followers_count is not null
  )
  or facebook_found is distinct from (
    nullif(btrim(facebook_url), '') is not null
    and facebook_followers is not null
  );
