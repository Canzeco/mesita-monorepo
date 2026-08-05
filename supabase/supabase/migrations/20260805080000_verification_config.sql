-- Verification Config — whether newly created places start as Verified Partner.
--
-- Backs the admin console's Verification Config page
-- (admin.mesita.ai/verification-config) via
-- admin-web-get-verification-config / admin-web-update-verification-config.
--
-- Consumer "Verified Partner" / "Not Verified" is projects.listing_type
-- ('partner' vs 'web'). Real ownership proof is phone OTP (project_verifications);
-- this knob lets operators create places as listing_type='partner' without that
-- proof — useful for catalog demos / bulk onboarding.
--
-- Default false: new places stay listing_type='web' (Not Verified) until an
-- operator grants a paid plan (admin-web-set-plan) or flips this toggle and
-- creates anew. Does NOT grant plan, ownership, or a promo strategy.
--
-- Enforcement: _shared/save-place.ts reads the flag on every create path
-- (admin / business / consumer). Unenforced config = bug.

alter table public.app_settings
  add column if not exists create_places_as_verified boolean not null default false;

comment on column public.app_settings.create_places_as_verified is
  'Verification Config: when true, savePlaceData inserts projects.listing_type=''partner'' (Verified Partner badge) even without phone ownership proof. Default false.';
