-- Visits config — the LOCAL context's policy blob.
--
-- Mesita runs one journey at the table (Bill · Reward · Task · QR · Pay ·
-- Validate · Results) and its behaviour is currently spread across hardcoded
-- constants in three apps: the tip presets in web-consumer, the 10s consumer
-- poll, web-check's 3s→30s staff backoff, and the pay rails whose card and
-- Yums panels are staged chrome. This blob is where those become operator
-- knobs.
--
-- The defaults MIRROR what the apps ship today, so the console describes the
-- product as it is. Every knob is labeled STAGED until the apps read it —
-- house rule: an unenforced config is a bug, and a staged one must say so.
--
-- NOT here, deliberately: what a visit PAYS (the Promos grid), who reads a
-- proof (Ojo), and the two invariants that must never become toggles — the tip
-- is always computed on the pre-discount bill, and the floor never adjudicates
-- a proof.
--
-- Shape:
--   tipEnabled / tipPresets / defaultTipPct   the bill step's tip chips; the
--                                             preselection must be one of them
--   consumerPollSeconds                       guest-side live sync
--   staffPollSeconds / staffPollMaxSeconds    check-page base + backoff ceiling
--   requireProofScreenshot                    task proof mandatory (the web UI
--                                             already requires it; the EF does
--                                             not — this states the intent)
--   maxFixRequests                            send-backs before the floor
--                                             settles it in person
--   payCash / payCard / payYums               which rails are open
--   autoCloseHours                            when an unvalidated ticket is
--                                             treated as abandoned
--   legacyV3Enabled                           the v3 submit-bill/mark-paid pair
--   reportEnabled                             the guest's report route

alter table public.app_config
  add column if not exists visits_config jsonb;

update public.app_config
set visits_config = coalesce(visits_config, jsonb_build_object(
  'tipEnabled', true,
  'tipPresets', jsonb_build_array(10, 15, 20),
  'defaultTipPct', 15,
  'consumerPollSeconds', 10,
  'staffPollSeconds', 3,
  'staffPollMaxSeconds', 30,
  'requireProofScreenshot', true,
  'maxFixRequests', 2,
  'payCash', true,
  'payCard', false,
  'payYums', false,
  'autoCloseHours', 12,
  'legacyV3Enabled', true,
  'reportEnabled', true
))
where id = 1;

comment on column public.app_config.visits_config is
  'Visit (local context) policy — THE TICKET journey. Read by the consumer and check apps when they are wired; edited at /visits-config. Rates are NOT here (Promos grid), proof reading is NOT here (Ojo). Knobs are STAGED until the apps consume them.';
