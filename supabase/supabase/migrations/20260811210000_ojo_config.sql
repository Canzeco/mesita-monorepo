-- MESITA-1035 — Ojo config: the proof-verification engine's policy blob.
--
-- Ojo (Spanish "eye"; "¡Ojo!" = watch out) reads the screenshot a guest posts
-- as proof of an Instagram story or a Google review (MESITA-1030 put those
-- screenshots in the ticket-proofs bucket) and returns a verdict. This blob is
-- the policy it runs on, editable at /ojo-config in the admin console.
--
-- The blob lands BEFORE the engine (MESITA-1034) so the page and the EF can
-- ship independently and the engine reads live policy on its first run. Every
-- knob is labeled STAGED in the UI until Ojo is live — house rule: an
-- unenforced config is a bug, and a staged one must say so.
--
-- Shape:
--   enabled            master switch; false = pure self-attest (today's
--                      behavior, MESITA-849) and no vision call is made
--   autoPassScore      >= this confidence auto-verifies the task
--   reviewFloorScore   >= this but below autoPass = verify + flag for the
--                      Verification Queue; below it = fail
--   failAction         what a fail does: "flag" (verify anyway, queue it) or
--                      "withhold" (task stays unverified, guest keeps base)
--   showGuestReason    whether the guest sees why a proof did not pass
--   maxRetries         proof re-submissions allowed per ticket
--   checks             which claims the model must assess per kind
--   prompt             operator-editable instruction prepended to the vision
--                      call (empty = the EF's built-in default)

alter table public.app_settings
  add column if not exists ojo_config jsonb;

update public.app_settings
set ojo_config = coalesce(ojo_config, jsonb_build_object(
  'enabled', false,
  'autoPassScore', 0.75,
  'reviewFloorScore', 0.45,
  'failAction', 'flag',
  'showGuestReason', true,
  'maxRetries', 3,
  'checks', jsonb_build_object(
    'placeNameMatches', true,
    'isRightSurface', true,
    'ratingPresent', true,
    'recentTimestamp', false
  ),
  'prompt', ''
))
where id = 1;

comment on column public.app_settings.ojo_config is
  'Ojo (proof-verification engine) policy — MESITA-1035. Read by ojo-* EFs, edited at /ojo-config. Knobs are STAGED until MESITA-1034 ships the engine.';
