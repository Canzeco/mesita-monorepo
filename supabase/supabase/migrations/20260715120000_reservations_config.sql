-- Reservations config — how a place's reservation endpoint is chosen.
--
-- Backs the admin console's Reservations Config page (admin.mesita.ai/reservations-config)
-- via admin-web-get-reservations-config / admin-web-update-reservations-config.
--
-- Every place carries ONE selected reservation endpoint at products.reservations
-- = { channel, value } — the address the Reservationist actually books through.
-- Until now the choice was hardcoded in the Enricher: phone > whatsapp > instagram
-- (Product Rules §G / MESITA-597). This lifts that rule out of the code and onto
-- the app_settings singleton, so the priority is an operator knob like every other
-- Mesita policy.
--
-- Convention mirrors the Sourcing / Memo / Enricher knobs: config lives on the
-- single-row public.app_settings (id = 1, RLS-enabled, no policies → EF-only).
-- Adding the column to the existing row resolves to the default policy below with
-- no data migration.
--
-- Shape:
--   priority               — ordered channel list, MOST preferred first. Order IS
--                            the rule; a channel absent from the list is ineligible.
--   disabled               — channels parked without losing their rank. A disabled
--                            channel is skipped even when it's the only contact the
--                            place has (the place then gets no endpoint at all).
--   respectAdminOverride   — true: a channel an operator picked by hand is never
--                            re-seeded by a later enrich. false: every re-enrich
--                            re-applies the priority, clobbering operator choices.
--                            Default true — the operator outranks the pipeline.
--
-- Channel keys are the contract shared with the admin catalog and
-- _shared/enrich-reservation-endpoint.ts: phone · whatsapp · instagram.
--
-- Enforcement: supabase-cron-enrich-place-contents reads this config and passes it
-- to selectReservationEndpoint on every contents-stage run. There is no unenforced
-- knob on this page.

alter table public.app_settings
  add column if not exists reservations_config jsonb not null default $reservations$
{
  "priority": ["phone", "whatsapp", "instagram"],
  "disabled": [],
  "respectAdminOverride": true
}
$reservations$::jsonb;
