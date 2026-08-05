-- MESITA-849 lifecycle v3 — the enum value the code has been writing all along.
--
-- v3a moved task verification to the GUEST: consumer-web-submit-story and
-- consumer-web-submit-review both set the action straight to 'self_verified'
-- (no screenshot, no staff ruling — the declaration IS the verification).
-- The value was never added to public.story_status, which types BOTH
-- tickets.story_status and — since Promos v5 reused the enum —
-- tickets.review_status.
--
-- So the write failed on the enum cast and the EF handed the guest
--   review_submit: invalid input value for enum story_status: "self_verified"
-- on the ticket screen, mid-visit. Both self-attested rungs (Instagram Story,
-- Google Review) have been dead since v3 shipped. The once-per-place claim is
-- refunded on that failure path, so no guest burned their one shot at a place
-- — they simply could not earn the rung at all.
--
-- Additive and loss-free: adding a value rewrites nothing, and no row can
-- hold it today because the writes never landed. The reader side already
-- knows the value — isActionVerified() in _shared/rewards-config.ts counts it
-- as verified and ticket-check.ts collapses it to "approved" for the check
-- page — which is why nothing in code review caught the missing half.

alter type public.story_status add value if not exists 'self_verified';

-- The 0005 comment still described the retired waiter ruling as the only way
-- a story ever got verified.
comment on column public.tickets.story_status is
  'Lifecycle of the Instagram Story rung. not_required when the flow does not carry it; self_verified is the v3 path (the guest attests, MESITA-849); pending -> submitted -> (ai|staff)_verified/rejected is the retired reviewed path, kept for historical rows.';
