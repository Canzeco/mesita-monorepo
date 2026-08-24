-- MESITA-1278. 0036 no-ops when coupons is missing. Collapse eight-tier
-- snapshot columns immediately after 20260531120003 creates the table, so
-- 20260711153426 can see welcome_free_rate. 20260824221900 is the same
-- work later in the ledger and is a no-op once this has run.

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

  if not exists (
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
