-- MESITA-842 — reservations_config narrows to phone (voice-reachable only).
--
-- WhatsApp was dropped fleet-wide (MESITA-839): nothing calls Twilio
-- Messages.json. Instagram DMs were never a serving path. Keeping them in the
-- operator picker / priority list made the Reservations Config binding look
-- honored when the Reservationist silently dialed places.phone instead.
--
-- Shape after this migration:
--   priority: ["phone"]
--   disabled: []
-- Other knobs on the jsonb (testCall, attempts, limits, …) are preserved.

alter table public.app_settings
  alter column reservations_config set default $reservations$
{
  "priority": ["phone"],
  "disabled": [],
  "respectAdminOverride": true
}
$reservations$::jsonb;

update public.app_settings
set reservations_config =
  coalesce(reservations_config, '{}'::jsonb)
    || jsonb_build_object(
      'priority', '["phone"]'::jsonb,
      'disabled', '[]'::jsonb
    )
where id = 1;
