-- MESITA-4690 — Remove Public profile: every Mesita profile is public. Pato,
-- 2026-11-22: "I said, remove Public profile, all profiles are public in
-- Mesita."
--
-- The Settings switch is gone and both write paths (consumer-web-update-
-- profile and the consumer-doc patch) refuse appear_anonymous with a 400
-- field_removed. This migration makes the column constant: any row still true
-- is set false (0 of 15 on prod, 2026-11-22), then a CHECK forbids true, so
-- every SQL reader (place_activity_visible, the feed, the person card,
-- place_views_log, the monitor rows) reads a constant without a body change.
-- Dropping the column and rewriting those readers is the follow-up, bundled
-- with the Stories table drops after 2026-11-29. It keeps
-- place_views_log.anonymous (signed-out views, MESITA-4678, and guests
-- without a verified Instagram).
--
-- Rollback: alter table public.consumers drop constraint
-- consumers_profile_always_public; restore the column comment from
-- 20261021090000.

update public.consumers
   set appear_anonymous = false
 where appear_anonymous;

alter table public.consumers
  add constraint consumers_profile_always_public check (not appear_anonymous);

comment on column public.consumers.appear_anonymous is
  'RETIRED (MESITA-4690): every Mesita profile is public. Always false (consumers_profile_always_public); no app or EF writes it. Dropped by the follow-up after 2026-11-29.';
