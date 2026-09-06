-- MESITA-1278. Filename sort applies 0036 before 20260531120003 creates
-- public.coupons. 0036 now no-ops the ALTER when the table is missing; this
-- file is the other half — apply the two-tier snapshot once the table exists.
--
-- Prod already ran 0036 against coupons, so bronze_rate is gone and this
-- block is a no-op. Empty-volume replay: 20260531120003 still creates the
-- eight-tier columns, then we collapse them here.
--
-- MESITA-1479: 0036's tail also unconditionally recreated
-- public.tg_saved_venues_issue_coupon(), copy-pasted into this replay file
-- too. That function was renamed away in 20260626260000 (venues to places)
-- and its renamed sibling (tg_saved_places_issue_coupon, plus the trigger
-- and public.coupons itself) was dropped for good in 20260818090000, six
-- days before this file was written. Nothing has pointed at the
-- venues-named function since June; this migration's own job is only the
-- column-snapshot ALTER above, so recreating a dead venues/coupons trigger
-- function served no purpose and, on a full fresh-history replay, just
-- resurrects banned vocabulary as permanently dead code. Removed. See
-- 20260818090000 for the real teardown of the (already renamed)
-- trigger/function/table.

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

notify pgrst, 'reload schema';
