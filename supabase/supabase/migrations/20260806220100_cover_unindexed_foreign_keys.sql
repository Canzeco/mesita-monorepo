-- MESITA-940: covering indexes for FK columns flagged by advisor 0001.
-- Additive only — no behavior change. Speeds ON DELETE/UPDATE cascades and
-- joins that filter by these foreign keys.

create index if not exists consumer_review_claims_project_id_idx
  on public.consumer_review_claims (project_id);

create index if not exists consumer_review_claims_ticket_id_idx
  on public.consumer_review_claims (ticket_id);

create index if not exists membership_strikes_compensation_coupon_id_idx
  on public.membership_strikes (compensation_coupon_id);

create index if not exists membership_strikes_consumer_id_idx
  on public.membership_strikes (consumer_id);

create index if not exists membership_strikes_ticket_id_idx
  on public.membership_strikes (ticket_id);

create index if not exists ticket_reports_consumer_id_idx
  on public.ticket_reports (consumer_id);

create index if not exists ticket_reviews_ticket_id_idx
  on public.ticket_reviews (ticket_id);
