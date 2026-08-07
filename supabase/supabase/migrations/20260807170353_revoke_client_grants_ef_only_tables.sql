-- MESITA-942: defense-in-depth grant hygiene for EF-only tables.
-- These tables have RLS enabled and ZERO policies (deliberate lockdown —
-- PostgREST clients see nothing). They still carried default GRANT ALL from
-- table creation. Revoke every privilege from anon/authenticated; service_role
-- retains full access via its bypass / explicit grants.

revoke all on table
  public.account_invites,
  public.accounts,
  public.app_settings,
  public.business_plans,
  public.consumer_code_counter,
  public.consumer_pay_notifications,
  public.consumer_review_claims,
  public.consumer_subscriptions,
  public.coupons,
  public.membership_strikes,
  public.place_enrichment_events,
  public.place_media_assets,
  public.project_members,
  public.project_subscriptions,
  public.project_verifications,
  public.reservation_call_counters,
  public.reservations,
  public.reward_rules,
  public.saved_places,
  public.stripe_events,
  public.super_admins,
  public.ticket_check_events,
  public.ticket_reports,
  public.ticket_reviews,
  public.tickets
from anon, authenticated;

-- Explicit service_role grants (idempotent) so operators / EFs keep working
-- even if default privileges change later.
grant all on table
  public.account_invites,
  public.accounts,
  public.app_settings,
  public.business_plans,
  public.consumer_code_counter,
  public.consumer_pay_notifications,
  public.consumer_review_claims,
  public.consumer_subscriptions,
  public.coupons,
  public.membership_strikes,
  public.place_enrichment_events,
  public.place_media_assets,
  public.project_members,
  public.project_subscriptions,
  public.project_verifications,
  public.reservation_call_counters,
  public.reservations,
  public.reward_rules,
  public.saved_places,
  public.stripe_events,
  public.super_admins,
  public.ticket_check_events,
  public.ticket_reports,
  public.ticket_reviews,
  public.tickets
to service_role;
