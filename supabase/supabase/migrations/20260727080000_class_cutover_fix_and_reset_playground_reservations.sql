-- Two fixes, one migration.
--
-- 1) Completes the class cutover from 20260726120000 (PR #497), which never
--    applied: it inserts 'standard' at rank 0 while 'free' still holds rank 0
--    and classes.rank is UNIQUE (membership_tiers_rank_key), so it aborts with
--    23505 every time. Same end state, collision-safe order: land 'standard'
--    at a temporary rank, repoint consumers, drop 'free', then take rank 0.
--    Live EFs already write class_key='standard' (claim-instagram, the stripe
--    webhook), so until this lands every one of those writes is an FK
--    violation against classes(key). 20260726120000 is marked applied in
--    schema_migrations (its end state is achieved here) so db push does not
--    re-run it and fail.
--
-- 2) admin_reset_database(): truncate playground_reservations. The table
--    arrived with 20260727010000 and carries NO foreign keys, so the CASCADE
--    on places/consumers never reaches it and reset silently left its rows
--    behind.

-- ─── 1. Class cutover (idempotent) ──────────────────────────────────────
insert into public.classes
  (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
select
  'standard', 'Standard',
  (select coalesce(max(rank), 0) + 10 from public.classes),
  null, 2, 0, 'MXN', 1.0
where not exists (select 1 from public.classes where key = 'standard');

update public.consumers set class_key = 'magnetic'
  where class_key = 'premium' and class_origin in ('instagram', 'invitation');
update public.consumers set class_key = 'standard'
  where class_key = 'free';

alter table public.consumers alter column class_key set default 'standard';
delete from public.classes where key = 'free';

update public.classes set
  label                     = 'Standard',
  rank                      = 0,
  follower_threshold        = null,
  monthly_reservation_limit = 2,
  price_cents               = 0,
  currency                  = 'MXN',
  recommendation_weight     = 1.0
where key = 'standard';
update public.classes set follower_threshold = null where key = 'premium';
update public.classes set follower_threshold = 5000 where key = 'magnetic';

-- ─── 2. Reset function ──────────────────────────────────────────────────
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
    public.playground_reservations,
    public.coupons,
    public.membership_strikes,
    public.saved_places,
    public.consumer_review_claims,
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
    ('standard', 'Standard', 0, null, 2,    0,     'MXN', 1.0),
    ('premium',  'Premium',  1, null, null, 10000, 'MXN', 1.5),
    ('magnetic', 'Magnetic', 2, 5000, null, 0,     'MXN', 1.5)
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

notify pgrst, 'reload schema';
