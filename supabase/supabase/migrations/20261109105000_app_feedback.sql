-- MESITA-3029 — feedback about the app itself, not a place. MESITA-3024 made
-- place reports the guest's feedback channel (three dots → Report); a guest
-- with something to say about Mesita had no door. Settings › Your account ›
-- Send feedback writes here (consumer-web-send-feedback) and admin reads it on
-- Activity › Feedback beside the place reports (admin-web-list-app-feedback).
--
-- decision: a sibling table, not a nullable place_id on place_reports. The
-- place_reports reasons are pinned to both apps' labels and every reader
-- names a place; app feedback has no reason and no place, only words.
--
-- Append-only: every send is its own row. EF-only, like place_reports: RLS on,
-- no policies, client roles hold nothing. admin_reset_database wipes it like
-- every non-survivor table.

create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 1000),
  created_at timestamptz not null default now()
);

comment on table public.app_feedback is
  'MESITA-3029: a guest''s feedback about the app (Settings › Send feedback), not tied to a place. Append-only. Read by Activity › Feedback. EF-only (RLS, no policies; client privileges revoked).';

create index app_feedback_recent_idx
  on public.app_feedback (created_at desc);
create index app_feedback_consumer_recent_idx
  on public.app_feedback (consumer_id, created_at desc);

alter table public.app_feedback enable row level security;
revoke all on table public.app_feedback from public, anon, authenticated;
grant all on table public.app_feedback to service_role;
