-- MESITA-911: Influencer door 1,000 → 2,000 Instagram followers.
--
-- Story Bonus already gates on Instagram connected (MESITA-909), not class.
-- Influencer needs a clearer reach bar; 2k (not retired Magnetic 5k) fits
-- Monterrey micro-reach. Live influencers today: 0 → no demotion blast.
-- Grant path reads DB (consumer-web-claim-instagram); clients mirror constants.

update public.classes
set follower_threshold = 2000
where key = 'influencer';

-- classes survives admin_reset and is re-seeded — keep the seed at 2,000.
create or replace function public.admin_reset_database()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  keep_tables constant text[] := array[
    'app_settings',
    'super_admins',
    'classes',
    'business_plans',
    'place_categories',
    'place_tags',
    'consumer_code_counter'
  ];
  wipe_tables text[];
  deleted_users bigint;
begin
  select coalesce(array_agg(format('public.%I', c.relname) order by c.relname), '{}'::text[])
    into wipe_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relispartition
     and c.relname <> all (keep_tables)
     and not exists (
       select 1 from pg_depend d
        where d.objid = c.oid
          and d.classid = 'pg_class'::regclass
          and d.deptype = 'e'
     );

  if coalesce(array_length(wipe_tables, 1), 0) > 0 then
    execute format(
      'truncate table %s restart identity cascade',
      array_to_string(wipe_tables, ', ')
    );
  end if;

  update public.consumer_code_counter set next_value = 0 where id = 1;

  insert into public.classes
    (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
  values
    ('standard', 'Standard', 0, null, 2,    0,     'MXN', 1.0),
    ('premium',  'Premium',  1, null, 10,   10000, 'MXN', 1.5),
    ('influencer', 'Influencer', 2, 2000, 10, 0,   'MXN', 1.5),
    ('aura',       'Aura',       3, null, 10, 0,   'MXN', 1.5)
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
    'truncated_tables', coalesce(array_length(wipe_tables, 1), 0),
    'deleted_auth_users', deleted_users,
    'reset_at', now()
  );
end;
$function$;

notify pgrst, 'reload schema';
