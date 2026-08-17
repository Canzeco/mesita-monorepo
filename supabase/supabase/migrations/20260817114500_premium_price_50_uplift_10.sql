-- Premium economics (decision: Pato, MESITA-1131): MX$50 / month, +10% uplift.
--
-- Two changes, one decision batch.
--
-- ── 1. PRICE: MX$100 → MX$50 / month ────────────────────────────────────────
-- `classes.price_cents` is the AUTHORITATIVE amount. resolvePlanPrice
-- (_shared/stripe-billing.ts) reads this row, compares it against the cached
-- Stripe price — `price.unit_amount === row.price_cents` — and provisions a
-- NEW Stripe price when they disagree, writing the new id back to
-- stripe_price_id. Stripe prices are immutable, so that self-provisioning is
-- the designed path for a price change: no dashboard step, and the now-stale
-- id heals on the next checkout rather than needing to be cleared here.
--
-- Existing subscribers are NOT re-priced. A live Stripe subscription keeps the
-- price it was created with; this only sets what a NEW checkout charges.
--
-- ── 2. UPLIFT: +20 → +10, reverting MESITA-1130 ─────────────────────────────
-- MESITA-1130 raised the conservative Premium step to +20 so the page could
-- claim it. Pato has set it back to +10, so the grid goes back with it — the
-- page claim follows the engine, never the other way round.
--
--   conservative, back to
--     bronze   10/30 → 10/20      gold     20/40 → 20/30
--     silver   15/35 → 15/25      diamond  25/45 → 25/35
--
-- AGGRESSIVE IS LEFT ALONE at +20. It was +20 before MESITA-1130 and was never
-- touched by it; reverting means restoring the prior state, not flattening
-- config that predates this. Consequence, same as before 1130: the "+10%" line
-- understates what an aggressive place pays. No live place runs aggressive.
--
-- Components after: base 10, class +0/+5/+10/+15, plan premium +10 — additive,
-- under RATE_MAX 70, round-trippable by the five-box editor.
--
-- BOTH ARTIFACTS, because both are read: rewards_config.v11 is what the quote
-- EF prefers, reward_rules is the 40-row mirror loadRewardGrid falls back to.
-- Derivation mirrors admin-web-update-rewards-config exactly:
--   discount_percent = least(70, cell + bonus[action])
--   bonuses: standing 0 · mesita_review 5 · story 10 · welcome 10 · review 15
-- Only the legacy `premium` row moves — it is the one bridging to
-- (bronze, premium); standard/influencer/aura read the FREE column.

update public.classes
set price_cents = 5000
where key = 'premium';

update public.app_settings
set rewards_config = jsonb_set(
      rewards_config,
      '{v11,visits,base,conservative}',
      jsonb_build_object(
        'bronze',  jsonb_build_object('free', 10, 'premium', 20),
        'silver',  jsonb_build_object('free', 15, 'premium', 25),
        'gold',    jsonb_build_object('free', 20, 'premium', 30),
        'diamond', jsonb_build_object('free', 25, 'premium', 35)
      )
    )
where id = 1;

update public.reward_rules
set discount_percent = least(
      70,
      20 + case action
             when 'standing'      then 0
             when 'mesita_review' then 5
             when 'story'         then 10
             when 'welcome'       then 10
             when 'review'        then 15
           end
    )
where strategy = 'conservative' and class = 'premium';
