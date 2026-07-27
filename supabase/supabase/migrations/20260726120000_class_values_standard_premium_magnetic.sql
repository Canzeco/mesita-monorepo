-- Consumer class VALUES: free/premium -> standard/premium/magnetic.
--
-- Standard replaces Free as the default class. Premium becomes PAID-ONLY (its
-- Instagram follower bar moves to Magnetic). Magnetic (added inert by v5,
-- 20260723020000) becomes the Instagram-earned top tier (rank 2). Giving
-- Magnetic a discount/weight EDGE over Premium is a separate confirmed
-- follow-up (unconfirmed live-pricing numbers) — NOT this migration.
--
-- Assignment (see consumer-web-claim-instagram / create-subscription / the
-- stripe webhook): Instagram >= follower bar -> Magnetic (origin 'instagram');
-- paid subscription -> Premium (origin 'subscription'); default -> Standard.
--
-- consumers.class_key is the ONLY FK into public.classes(key) (0034), so the
-- free->standard cutover only has to repoint that one table.

-- 1 - Add 'standard' (the old 'free' defaults) before repointing any consumer.
insert into public.classes
  (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
values
  ('standard', 'Standard', 0, null, 2, 0, 'MXN', 1.0)
on conflict (key) do update set
  label                     = excluded.label,
  rank                      = excluded.rank,
  follower_threshold        = excluded.follower_threshold,
  monthly_reservation_limit = excluded.monthly_reservation_limit,
  price_cents               = excluded.price_cents,
  currency                  = excluded.currency,
  recommendation_weight     = excluded.recommendation_weight;

-- 2 - Reclassify existing consumers.
--   free                     -> standard (the rename)
--   premium via Instagram    -> magnetic (IG is now the Magnetic door)
--   premium via invitation   -> magnetic (curated comp; Premium is paid-only now)
--   premium via subscription -> stay premium (paid keeps it)
update public.consumers set class_key = 'magnetic'
  where class_key = 'premium' and class_origin in ('instagram', 'invitation');
update public.consumers set class_key = 'standard'
  where class_key = 'free';

-- 3 - New default, then retire the now-unreferenced 'free' row.
alter table public.consumers alter column class_key set default 'standard';
delete from public.classes where key = 'free';

-- 4 - Split the earned/paid axes. Premium: paid-only -> drop the follower bar.
--   Magnetic: IG-earned -> 5,000-follower bar (scarce). NB the 1,000 bar is the
--   separate Story-reward eligibility, NOT the Magnetic class. Magnetic keeps its
--   v5 weight (1.5, == Premium); a discount/weight edge over Premium is a
--   separate confirmed follow-up, not here.
update public.classes set follower_threshold = null where key = 'premium';
update public.classes set follower_threshold = 5000 where key = 'magnetic';

-- 5 - admin_reset_database(): seed standard/premium/magnetic (was free/premium/
--     magnetic). Body otherwise identical to 20260723020000.
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
