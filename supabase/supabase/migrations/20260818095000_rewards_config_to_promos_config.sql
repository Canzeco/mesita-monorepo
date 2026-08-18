-- Finish the reward retirement.
--
-- reward / promo / discount were three words for one idea, and `projects`
-- carried two of them as separate columns (reward_cap_cents AND
-- monthly_promo_cap). Two survive with distinct jobs:
--
--   promo    = the offer a project configures
--   discount = the money a guest actually gets
--
-- reward was a synonym for whichever one was nearest. 20260818092000 already
-- moved reward_cap_cents -> discount_cap_cents; this is the other half. Leaving
-- it half-done is worse than not having started: the v11 blob that prices every
-- ticket would keep teaching the retired word to everyone who opens the table.

alter table public.app_config rename column rewards_config to promos_config;
