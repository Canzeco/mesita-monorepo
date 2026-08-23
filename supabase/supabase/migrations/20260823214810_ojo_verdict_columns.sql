-- Ojo — the proof-verification engine's persisted output (MESITA-1034).
--
-- Ojo reads the screenshot a guest posts as proof of an Instagram story or a
-- Google review and returns a verdict. This does NOT change the ticket
-- lifecycle by itself: story_status / review_status still flip to
-- 'self_verified' synchronously at submit time (MESITA-849 self-attestation
-- is unchanged), and Ojo runs afterward, in the background, only when
-- app_config.ojo_config.enabled is true.
--
-- The verdict/confidence/reasons columns are pure annotation — nothing reads
-- them to gate money. What DOES gate money is story_status/review_status
-- itself, via the EXISTING isActionVerified() check in
-- _shared/rewards-config.ts, which every rate resolution already calls live.
-- So Ojo's engine writes those two enum columns directly when it needs to
-- change eligibility, reusing values that already exist and are already
-- correctly wired:
--   'ai_verified' — already in VERIFIED_ACTION_STATUSES (counts as verified)
--   'ai_rejected' — already NOT in VERIFIED_ACTION_STATUSES (excluded)
-- Both were added in 0005_ticket_taxonomy.sql for a retired pre-MESITA-849
-- "AI + waiter fallback" design and have sat unused since. Ojo is the reader
-- those values were originally built for; no new enum value is needed.

alter table public.visit_tickets
  add column if not exists story_ojo_verdict text,
  add column if not exists story_ojo_confidence numeric,
  add column if not exists story_ojo_reasons text[],
  add column if not exists story_ojo_checked_at timestamptz,
  add column if not exists story_ojo_attempts smallint not null default 0,
  add column if not exists review_ojo_verdict text,
  add column if not exists review_ojo_confidence numeric,
  add column if not exists review_ojo_reasons text[],
  add column if not exists review_ojo_checked_at timestamptz,
  add column if not exists review_ojo_attempts smallint not null default 0;

alter table public.visit_tickets
  drop constraint if exists visit_tickets_story_ojo_verdict_check,
  add constraint visit_tickets_story_ojo_verdict_check
    check (story_ojo_verdict is null or story_ojo_verdict in ('pass', 'unsure', 'fail')),
  drop constraint if exists visit_tickets_review_ojo_verdict_check,
  add constraint visit_tickets_review_ojo_verdict_check
    check (review_ojo_verdict is null or review_ojo_verdict in ('pass', 'unsure', 'fail')),
  drop constraint if exists visit_tickets_story_ojo_confidence_check,
  add constraint visit_tickets_story_ojo_confidence_check
    check (story_ojo_confidence is null or story_ojo_confidence between 0 and 1),
  drop constraint if exists visit_tickets_review_ojo_confidence_check,
  add constraint visit_tickets_review_ojo_confidence_check
    check (review_ojo_confidence is null or review_ojo_confidence between 0 and 1);

comment on column public.visit_tickets.story_ojo_verdict is
  'Ojo''s read of story_screenshot_url: pass/unsure/fail, null = not run (disabled or not yet completed). Annotation only — does not itself gate money; see story_status.';
comment on column public.visit_tickets.story_ojo_attempts is
  'How many times Ojo has actually called the vision model for this ticket''s story proof. Gates ojo_config.maxRetries — once exhausted, a further fail never re-triggers a withhold, it only flags (never leaves a guest in an unresolvable retry loop).';
comment on column public.visit_tickets.review_ojo_verdict is
  'Ojo''s read of review_screenshot_url: pass/unsure/fail, null = not run. Annotation only; see review_status.';
comment on column public.visit_tickets.review_ojo_attempts is
  'How many times Ojo has actually called the vision model for this ticket''s review proof. Gates ojo_config.maxRetries.';
