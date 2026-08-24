-- MESITA-1278. Filename sort applies 0036 before 20260531120003 creates
-- public.coupons. 0036 now no-ops the ALTER when the table is missing; this
-- file is the other half — apply the two-tier snapshot once the table exists.
--
-- Prod already ran 0036 against coupons, so bronze_rate is gone and this
-- block is a no-op. Empty-volume replay: 20260531120003 still creates the
-- eight-tier columns, then we collapse them here.

do $mesita_1278$
begin
  if to_regclass('public.coupons') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'coupons'
      and column_name = 'bronze_rate'
  ) then
    alter table public.coupons
      drop column if exists welcome_bronze_rate,
      drop column if exists welcome_silver_rate,
      drop column if exists welcome_gold_rate,
      drop column if exists welcome_diamond_rate,
      drop column if exists bronze_rate,
      drop column if exists silver_rate,
      drop column if exists gold_rate,
      drop column if exists diamond_rate;
  end if;

  if to_regclass('public.coupons') is not null
     and not exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'coupons'
         and column_name = 'free_rate'
     ) then
    alter table public.coupons
      add column welcome_free_rate    smallint check (welcome_free_rate    is null or welcome_free_rate    in (10, 20, 50, 70)),
      add column welcome_premium_rate smallint check (welcome_premium_rate is null or welcome_premium_rate in (10, 20, 50, 70)),
      add column free_rate            smallint check (free_rate            is null or free_rate            in (10, 20, 50, 70)),
      add column premium_rate         smallint check (premium_rate         is null or premium_rate         in (10, 20, 50, 70));
  end if;
end
$mesita_1278$;

create or replace function public.tg_saved_venues_issue_coupon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select
    listing_type,
    welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate,
    currency
  into v
  from public.venues
  where id = new.venue_id;

  if not found or v.listing_type <> 'partner' then
    return new;
  end if;

  insert into public.coupons (
    consumer_id, venue_id, saved_venue_id,
    welcome_free_rate, welcome_premium_rate,
    free_rate, premium_rate,
    cap_cents, currency
  ) values (
    new.consumer_id, new.venue_id, new.id,
    v.welcome_free_rate, v.welcome_premium_rate,
    v.free_rate, v.premium_rate,
    0,
    coalesce(v.currency, 'MXN')
  )
  on conflict (consumer_id, venue_id) where status = 'active' do nothing;

  return new;
end;
$$;

revoke execute on function public.tg_saved_venues_issue_coupon() from anon, authenticated, public;

notify pgrst, 'reload schema';
