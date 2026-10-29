-- MESITA-3024 — guest feedback (Pato, 2026-10-28: "the instagram link is
-- wrong or facebook links is wrong ... in admin create a Feedback page where
-- you receive those logs"). place_reports becomes an append-only log:
--
--   * every send is its own row (an `id` key replaces the consumer × place
--     key, so a second report no longer replaces the first);
--   * a new reason, `wrong_links` (Instagram, Facebook, website, menu,
--     booking);
--   * an index on (consumer_id, created_at desc) for the hourly flood cap in
--     consumer-web-report-place; the old key was the only index that led on
--     consumer_id.
--
-- The table held 0 rows when this shipped, so the key swap loses nothing.
-- RLS, the revoked client privileges and the cascades stay as they were.

alter table public.place_reports drop constraint place_reports_pkey;
alter table public.place_reports
  add column id uuid not null default gen_random_uuid();
alter table public.place_reports add primary key (id);

alter table public.place_reports drop constraint place_reports_reason_check;
alter table public.place_reports add constraint place_reports_reason_check
  check (reason in (
    'closed',
    'wrong_info',
    'wrong_links',
    'wrong_location',
    'inappropriate_photos',
    'duplicate',
    'other'
  ));

create index place_reports_consumer_recent_idx
  on public.place_reports (consumer_id, created_at desc);

comment on table public.place_reports is
  'MESITA-2684/MESITA-3024: guest feedback on a place (the three dots, Report). Append-only: every send is its own row. Read by Manage › Feedback and Single Place › Admin › Reports. EF-only (RLS, no policies; client privileges revoked).';
