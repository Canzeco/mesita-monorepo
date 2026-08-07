-- MESITA-942: PUBLIC role often retains default table privileges independently
-- of anon/authenticated. Revoke from PUBLIC too so PostgREST OpenAPI doesn't
-- advertise writable surfaces on EF-only tables.

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
  public.tickets,
  public.place_research,
  public.place_creation_attempts,
  public.consumer_mcp_tokens,
  public.admin_reset_preserve
from public;

revoke insert, update, delete, truncate, trigger, references
  on table
    public.classes,
    public.consumers,
    public.place_categories,
    public.place_tags,
    public.places,
    public.projects,
    public.projects_view
  from public;
