-- Credits expire, and expiry is counted in DAYS (Pato, 2026-09-02).
--
-- `controls_config` shipped with the HOLD — how long a top-up sits before it
-- can be spent — and left the other end of the instrument's life open:
-- credits-mock.ts listed "whether balances expire, and what happens to the
-- remainder if they do" as deliberately undecided. The first half is decided
-- now. Unspent Credits expire, the period is a number of DAYS, and the console
-- owns it like every other term.
--
-- DAYS, NOT HOURS. The hold is an afternoon and reads naturally in hours; the
-- life of the instrument is a season, and a knob that makes an operator type
-- 2160 to mean a quarter is a knob that will be mistyped. The two live in the
-- same blob wearing different units on purpose, and each label says which.
--
-- NINETY DAYS ("it must be a lot"). A guest who prepays a place they like eats
-- there monthly, not weekly. A life measured in weeks would expire money that
-- was always going to be spent, and the first thing a guest learned about
-- Credits would be that they evaporate.
--
-- THE GUARD IS A FLOOR, NOT A CEILING — the mirror image of `maxHoldHours`.
-- A LONGER hold is the term that hurts a guest, so the operator caps it; a
-- SHORTER expiry is, so the operator sets the shortest life a place may sell:
-- `minExpiryDays` = 30. Both guards point at the same person. A place may
-- always sell a LONGER life, which is it giving away more than it promised.
--
-- Normalization additionally raises the floor to cover the longest hold a place
-- could set (`_shared/controls-config.ts`), so no combination of these four
-- numbers can sell a guest money that is locked for its entire life.
--
-- NOT decided here: what happens to the REMAINDER on expiry — forfeited to the
-- place, or the paid half returned. That is a settlement question with no book
-- behind it. Expiry stops the money being spendable without answering it.
--
-- Two statements, the house pattern: the DEFAULT is what a fresh database
-- seeds, the UPDATE merges the keys into the singleton that already exists.
-- `||` with the stored blob on the RIGHT means an operator value already in the
-- row wins; only the genuinely absent keys are added.

alter table public.app_config
  alter column controls_config set default jsonb_build_object(
    'defaultHoldHours', 3,
    'defaultBonusPct', 5,
    'maxHoldHours', 72,
    'minHoldHours', 0,
    'defaultExpiryDays', 90,
    'minExpiryDays', 30
  );

update public.app_config
set controls_config = jsonb_build_object(
      'defaultExpiryDays', 90,
      'minExpiryDays', 30
    ) || coalesce(controls_config, '{}'::jsonb)
where id = 1;

comment on column public.app_config.controls_config is
  'Wallet Credits controls, owned by admin console > Configurations > Controls. defaultHoldHours (3) is the hold a place INHERITS when it has set none - a fallback, not a flat rule; a place may hold longer up to maxHoldHours (72) to justify a bigger bonus. defaultBonusPct (5) applies the same way. defaultExpiryDays (90) is how long unspent Credits live, counted in DAYS from the top-up; minExpiryDays (30) is the shortest life a place may sell - a FLOOR, because a short expiry is what hurts a guest, where a long hold is. minHoldHours ships unrendered: no reader yet. Read by admin-web-get/update-controls-config and consumer-web-get-controls-config.';

-- Post-flight: the column and its six keys must exist, and the expiry must be
-- a DAY count rather than the hold's unit smuggled across. A value in the
-- thousands is hours-in-disguise; this apply aborts before any EF reads it.
do $$
declare
  cfg jsonb;
begin
  select controls_config into cfg from public.app_config where id = 1;
  if cfg is null then
    raise exception 'app_config.controls_config missing after add';
  end if;
  if not (cfg ? 'defaultHoldHours' and cfg ? 'defaultBonusPct'
          and cfg ? 'maxHoldHours' and cfg ? 'minHoldHours'
          and cfg ? 'defaultExpiryDays' and cfg ? 'minExpiryDays') then
    raise exception 'app_config.controls_config is missing a key: %', cfg;
  end if;
  if (cfg->>'defaultExpiryDays')::numeric > 3650
     or (cfg->>'minExpiryDays')::numeric > 3650 then
    raise exception 'controls_config expiry is not in days: %', cfg;
  end if;
  if (cfg->>'minExpiryDays')::numeric * 24
     < (cfg->>'maxHoldHours')::numeric then
    raise exception 'controls_config would expire Credits before they mature: %', cfg;
  end if;
end $$;

notify pgrst, 'reload schema';
