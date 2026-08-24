-- MESITA-1248: fold the verification domain's three loose scalar columns
-- (create_places_as_verified, auto_verify_ai_call, auto_verify_ai_email) into
-- one jsonb column, matching the whole-blob-per-domain pattern already used
-- by sourcing_config/reservations_config/ojo_config/etc. auto_verify_video
-- was already retired (dead config, separate PR) and has no home here.
--
-- Backfill preserves each column's exact existing value, defaulting per the
-- same semantics the app code already used (create_places_as_verified false
-- unless true; the two auto_verify_* flags true unless explicitly false).
alter table public.app_config
  add column if not exists verification_config jsonb not null default jsonb_build_object(
    'createPlacesAsVerified', false,
    'autoVerifyAiCall', true,
    'autoVerifyAiEmail', true
  );

update public.app_config
set verification_config = jsonb_build_object(
  'createPlacesAsVerified', coalesce(create_places_as_verified, false),
  'autoVerifyAiCall', coalesce(auto_verify_ai_call, true),
  'autoVerifyAiEmail', coalesce(auto_verify_ai_email, true)
)
where id = 1;

alter table public.app_config
  drop column if exists create_places_as_verified,
  drop column if exists auto_verify_ai_call,
  drop column if exists auto_verify_ai_email;
