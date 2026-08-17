-- Premium is worth +20, not +10 (decision: Pato, MESITA-1130).
--
-- The v11 grid is additive: grid[s][cls][plan] = base[s] + classStep + planStep,
-- so the Premium uplift is ONE knob per strategy. Aggressive already pays +20;
-- conservative paid +10, and conservative is what every live place runs — so
-- the consumer-facing "+20% extra" was true nowhere until this.
--
--   conservative, before → after
--     bronze   10/20 → 10/30
--     silver   15/25 → 15/35
--     gold     20/30 → 20/40
--     diamond  25/35 → 25/45
--
-- Components after: base 10, class +0/+5/+10/+15, plan premium +20. That stays
-- additive (additivityError only rejects a negative plan step or an inverted
-- class ladder), every cell is under RATE_MAX 70, and the editor at
-- Admin › Promos Config can still round-trip it.
--
-- TWO ARTIFACTS, because both are read. `rewards_config.v11` is the source of
-- truth the quote EF prefers; `reward_rules` is the 40-row mirror it falls back
-- to (loadRewardGrid). Writing one without the other would leave a fallback
-- paying the old rate. Normally admin-web-update-rewards-config writes both in
-- one pass — this migration reproduces its exact derivation:
--   discount_percent = least(70, cell + bonus[action])
--   bonuses: standing 0 · mesita_review 5 · story 10 · welcome 10 · review 15
-- verified against all 20 live conservative rows before writing.
--
-- Only the LEGACY `premium` class row moves: it is the one that bridges to
-- (bronze, premium). standard/influencer/aura all read the FREE column, which
-- this migration does not touch.

update public.app_settings
set rewards_config = jsonb_set(
      rewards_config,
      '{v11,visits,base,conservative}',
      jsonb_build_object(
        'bronze',  jsonb_build_object('free', 10, 'premium', 30),
        'silver',  jsonb_build_object('free', 15, 'premium', 35),
        'gold',    jsonb_build_object('free', 20, 'premium', 40),
        'diamond', jsonb_build_object('free', 25, 'premium', 45)
      )
    )
where id = 1;

update public.reward_rules
set discount_percent = least(
      70,
      30 + case action
             when 'standing'      then 0
             when 'mesita_review' then 5
             when 'story'         then 10
             when 'welcome'       then 10
             when 'review'        then 15
           end
    )
where strategy = 'conservative' and class = 'premium';
