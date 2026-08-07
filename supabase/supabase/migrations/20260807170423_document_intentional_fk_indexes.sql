-- MESITA-942: advisor 0005 flags many FK-covering indexes as "unused".
-- They exist for DELETE/UPDATE parent-row checks and low-cardinality
-- joins that stats have not yet exercised. Keep them; document the posture.

comment on index public.idx_super_admins_added_by is
  'FK cover on super_admins.added_by. Advisor 0005 unused = keep (MESITA-940/942).';
comment on index public.consumer_review_claims_project_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.consumer_review_claims_ticket_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.membership_strikes_compensation_coupon_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.membership_strikes_consumer_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.membership_strikes_ticket_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.ticket_reports_consumer_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.ticket_reviews_ticket_id_idx is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.idx_coupons_saved_place_id is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.idx_reservations_coupon_id is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.idx_tickets_story_verified_by is
  'FK cover. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.tickets_reservation_idx is
  'FK cover on tickets.reservation_id. Advisor 0005 unused = keep (MESITA-942).';

-- Queue partials also flagged unused by advisor 0005 — keep; they match
-- admin/business verification queues once traffic hits those filters.
comment on index public.tickets_story_status_idx is
  'Partial queue: story submitted|ai_rejected. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.tickets_review_status_idx is
  'Partial queue: review submitted|ai_rejected. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.project_verifications_pending_idx is
  'Partial pending verification queue. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.place_enrichment_events_project_idx is
  'Activity feed (project_id, created_at desc). Advisor 0005 unused = keep (MESITA-942).';
comment on index public.account_invites_email_idx is
  'Invite lookup by email. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.place_media_assets_status_idx is
  'Media pipeline status filter. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.idx_project_subscriptions_plan_key is
  'Plan filter on subscriptions. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.super_admins_user_idx is
  'Lookup by user_id. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.coupons_consumer_idx is
  'Consumer coupon list. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.coupons_project_idx is
  'Project coupon list. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.membership_strikes_project_idx is
  'Strikes by project. Advisor 0005 unused = keep (MESITA-942).';
comment on index public.places_country_idx is
  'Geo filter. Advisor 0005 unused = keep (MESITA-942).';
-- places_embedding_hnsw is the Lineup vector index — unused only until
-- recall traffic hits pgvector; never drop.
comment on index public.places_embedding_hnsw is
  'Lineup HNSW embedding index. Advisor 0005 unused until recall volume; keep (MESITA-942).';
