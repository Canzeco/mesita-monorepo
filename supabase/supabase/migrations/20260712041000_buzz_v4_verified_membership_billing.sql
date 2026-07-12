-- Buzz v4 Verified membership billing (MESITA-541).
--
-- Retire Pro (MX$100/mo) / Ultra (MX$5,000/mo) as sold SKUs. The single
-- billable business product is Verified membership at MX$1,000/year, keyed
-- to business_plans.pro (same plan enum the Buzz Promos UI already uses for
-- "plan ≠ free ⇒ member"). Ultra stays in the lookup for legacy places /
-- FK integrity but is no longer self-provisioned in Stripe.
--
-- Clears pro.stripe_price_id so the next real checkout provisions the yearly
-- price (lookup_key business_verified_yearly) instead of reusing a stale
-- monthly cache. MOCK_SUBSCRIPTION stays true — live charges are MESITA-37.

update public.business_plans
set
  label = 'Verified',
  price_cents = 100000,
  currency = 'MXN',
  stripe_price_id = null
where key = 'pro';

-- Keep ultra row for legacy subscribers; stop selling it (catalog retired in
-- stripe-billing.ts). Leave price as-is so historical mirrors stay readable.

-- Restore admin_reset_database with the Verified seed amounts.
create or replace function public.admin_reset_database()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  deleted_users bigint;
begin
  truncate table
    public.ticket_reviews,
    public.consumer_pay_notifications,
    public.staff_whatsapp_messages,
    public.staff_whatsapp_sessions,
    public.consumer_subscriptions,
    public.project_subscriptions,
    public.stripe_events,
    public.reservations,
    public.coupons,
    public.saved_places,
    public.tickets,
    public.project_verifications,
    public.account_invites,
    public.staff_invites,
    public.project_roles,
    public.project_members,
    public.place_enrichment_events,
    public.place_creation_attempts,
    public.consumer_mcp_tokens,
    public.place_media_assets,
    public.place_research,
    public.projects,
    public.places,
    public.consumers,
    public.accounts
  restart identity cascade;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
  values
    ('free',    'Free',    0, null, 2,    0,     'MXN', 1.0),
    ('premium', 'Premium', 1, 1000, null, 10000, 'MXN', 1.5)
  on conflict (key) do update set
    label                     = excluded.label,
    rank                      = excluded.rank,
    follower_threshold        = excluded.follower_threshold,
    monthly_reservation_limit = excluded.monthly_reservation_limit,
    price_cents               = excluded.price_cents,
    currency                  = excluded.currency,
    recommendation_weight     = excluded.recommendation_weight;

  insert into public.business_plans (key, label, price_cents, currency) values
    ('pro',   'Verified', 100000, 'MXN'),
    ('ultra', 'Ultra',    500000, 'MXN')
  on conflict (key) do update set
    label       = excluded.label,
    price_cents = excluded.price_cents,
    currency    = excluded.currency;

  perform public.seed_place_categories();
  perform public.seed_place_tags();

  delete from auth.users u
  where u.email is null
     or lower(u.email) not in (select lower(email) from public.super_admins);
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted_auth_users', deleted_users,
    'preserved_media_assets', true,
    'reset_at', now()
  );
end;
$function$;
