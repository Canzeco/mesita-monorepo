-- MESITA-942: document grant posture after client-privilege revoke.

comment on table public.accounts is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.tickets is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.reservations is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.super_admins is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.app_settings is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.reward_rules is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.project_members is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.coupons is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.saved_places is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.stripe_events is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.membership_strikes is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.place_media_assets is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.place_enrichment_events is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.account_invites is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.business_plans is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.consumer_subscriptions is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.consumer_pay_notifications is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.consumer_review_claims is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.consumer_code_counter is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.project_subscriptions is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.project_verifications is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.reservation_call_counters is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.ticket_check_events is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.ticket_reports is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';
comment on table public.ticket_reviews is
  'EF-only (RLS, no policies). Client roles: no privileges. MESITA-942.';

comment on table public.places is
  'Browse base table. Client roles: SELECT only (RLS places_select_public_visible). Writes via service_role EFs. MESITA-942.';
comment on table public.projects is
  'Browse base table. Client roles: SELECT only (RLS projects_select_public_visible). Writes via service_role EFs. MESITA-942.';
comment on table public.classes is
  'Vocabulary. Client roles: SELECT only. MESITA-942.';
comment on table public.place_categories is
  'Vocabulary. Client roles: SELECT only. MESITA-942.';
comment on table public.place_tags is
  'Vocabulary. Client roles: SELECT only. MESITA-942.';
comment on table public.consumers is
  'Consumer profile. Client roles: SELECT self only (RLS). Writes via service_role EFs. MESITA-942.';
