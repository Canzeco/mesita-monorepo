-- Orders config — the policy for the REMOTE context.
--
-- Mesita prices two contexts and only one of them shipped: a VISIT (the guest
-- is at the place, ticket + QR) and an ORDER (the guest is not). Orders are
-- parked everywhere — no orders table, no order EF, no consumer type — and
-- three surfaces already promise them: the Premium perk list ("30 orders per
-- month", soon), the consumer Inbox › Orders section, and the parked `orders`
-- column of the Promos v11 grid.
--
-- This blob lands BEFORE the rail, the same way ojo_config landed before its
-- engine: the page and the EFs ship independently, and the rail reads live
-- policy on its first run. Every knob is labeled STAGED in the console until
-- then — house rule: an unenforced config is a bug, and a staged one must say
-- so.
--
-- What an order PAYS is deliberately NOT here: rates live in the Promos grid's
-- `orders` context, behind its own additivity guard.
--
-- Shape:
--   enabled              master switch; false = orders do not exist for anyone
--   channels             how a guest places one: inHouse (Mesita cart, not
--                        built) · externalLink (the place's own link) ·
--                        whatsapp (a message to the place)
--   delivery / pickup    which fulfilments count as an order
--   monthlyQuotaFree     orders per consumer per month on the Free plan
--   monthlyQuotaPremium  …and on Premium; never below the Free quota, or the
--                        paid plan would take a perk away
--   minOrderMxn          order floor to be eligible for a reward
--   rewardWindowHours    how long after an order the reward can be claimed
--   requireProof         a receipt must be posted (no QR exists remotely)

-- The settings singleton is mid-rename: `app_settings` became `app_config` on
-- the live DB (20260818090000–096000, cloud-applied, repo mirror pending), so
-- this file resolves the table instead of naming one. Both branches collapse
-- to the same DDL the moment the rename is mirrored here.
do $$
declare
  tbl text := coalesce(
    (select to_regclass('public.app_config')::text),
    (select to_regclass('public.app_settings')::text)
  );
begin
  if tbl is null then
    raise exception 'no settings singleton found (app_config / app_settings)';
  end if;

  execute format('alter table %s add column if not exists orders_config jsonb', tbl);

  execute format($f$
    update %s
    set orders_config = coalesce(orders_config, %L::jsonb)
    where id = 1
  $f$, tbl, jsonb_build_object(
    'enabled', false,
    'channels', jsonb_build_object(
      'inHouse', false,
      'externalLink', true,
      'whatsapp', false
    ),
    'delivery', true,
    'pickup', true,
    'monthlyQuotaFree', 0,
    'monthlyQuotaPremium', 30,
    'minOrderMxn', 150,
    'rewardWindowHours', 24,
    'requireProof', true
  ));

  execute format(
    'comment on column %s.orders_config is %L',
    tbl,
    'Order (remote context) policy. Read by the order rail when it ships, edited at /orders-config. Rates are NOT here — they live in the Promos grid orders context. Knobs are STAGED until the rail exists.'
  );
end $$;
