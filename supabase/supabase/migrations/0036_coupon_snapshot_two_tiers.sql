-- 0036 — collapse the coupon rate snapshot from eight tiers to four.
--
-- Coupons snapshot the venue's promo rates at issue time (so later venue
-- edits don't devalue an already-issued coupon). With the venue rates
-- collapsed to free/premium (0032), the coupon snapshot columns and the
-- auto-issue trigger follow.

-- Filename sort runs every 00NN file before every YYYYMMDD file. Prod applied
-- 0036 after 20260531120003 created public.coupons. An empty volume hits this
-- ALTER first and dies (MESITA-1278). Skip the table work when the relation
-- is missing; 20260824221900 reapplies it once coupons exists.
do $mesita_1278$
begin
  if to_regclass('public.coupons') is null then
    return;
  end if;

  alter table public.coupons
    drop column if exists welcome_bronze_rate,
    drop column if exists welcome_silver_rate,
    drop column if exists welcome_gold_rate,
    drop column if exists welcome_diamond_rate,
    drop column if exists bronze_rate,
    drop column if exists silver_rate,
    drop column if exists gold_rate,
    drop column if exists diamond_rate;

  alter table public.coupons
    add column welcome_free_rate    smallint check (welcome_free_rate    is null or welcome_free_rate    in (10, 20, 50, 70)),
    add column welcome_premium_rate smallint check (welcome_premium_rate is null or welcome_premium_rate in (10, 20, 50, 70)),
    add column free_rate            smallint check (free_rate            is null or free_rate            in (10, 20, 50, 70)),
    add column premium_rate         smallint check (premium_rate         is null or premium_rate         in (10, 20, 50, 70));
end
$mesita_1278$;

-- Re-issue the auto-issue trigger against the new columns. Binding
-- (after insert on saved_venues) is unchanged.
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

-- Preserve the 0031_b hardening: trigger fns are never client-callable.
revoke execute on function public.tg_saved_venues_issue_coupon() from anon, authenticated, public;

notify pgrst, 'reload schema';
