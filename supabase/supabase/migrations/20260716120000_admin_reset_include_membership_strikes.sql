-- admin_reset_database(): enumerate membership_strikes explicitly.
--
-- membership_strikes (added 2026-07-12, migration 20260712040000) is operational
-- per-project/consumer data a reset must wipe. Today it is cleared only
-- incidentally: TRUNCATE ... CASCADE reaches it through its FKs to projects /
-- consumers / tickets / coupons. Every other operational child (saved_places,
-- place_media_assets, ...) is cascade-covered too yet still listed explicitly,
-- so the truncate list stays a complete, auditable inventory instead of
-- silently depending on an FK a later migration might drop. Add
-- membership_strikes to match that convention. Body is otherwise
-- byte-identical to 20260714222500.

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
    public.membership_strikes,
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
  where not exists (
    select 1
    from public.super_admins sa
    where (u.email is not null and lower(u.email) = lower(sa.email))
       or (u.phone is not null and sa.phone is not null and u.phone = sa.phone)
       or (sa.user_id is not null and sa.user_id = u.id)
  );
  get diagnostics deleted_users = row_count;

  return jsonb_build_object(
    'ok', true,
    'deleted_auth_users', deleted_users,
    'preserved_media_assets', true,
    'reset_at', now()
  );
end;
$function$;
