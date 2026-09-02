-- Controls config (MESITA wallet redesign, Pato 2026-09-01).
--
-- The Wallet's prepaid Credits ran on a browser emulator with the hold window
-- baked into a fixture: `CREDIT_PLACES` carried a per-place `lockHours` and
-- nothing else could set it. Pato set the product default at THREE HOURS and
-- asked for a console page that owns it, so the number needs somewhere real to
-- live — root CLAUDE.md: unenforced config is a bug.
--
-- A FALLBACK, NOT A FLAT RULE (Pato, 2026-09-01, D7). A place may still set a
-- longer hold to justify a bigger bonus — that pairing is the whole prepay
-- pitch, since what the place buys is float and the bonus is the rate it pays.
-- `defaultHoldHours` is what a place inherits when it has set nothing, which
-- today is every place. `maxHoldHours` is the ceiling on the per-place
-- override so no venue can lock a guest's money indefinitely.
--
-- `minHoldHours` ships in the blob but NOT on the page: there is no reader for
-- a floor yet and a knob without a reader is a question nobody asked. It
-- round-trips on save so a later reader sees the operator's value.
--
-- Two statements, the house pattern: the DEFAULT is what a fresh database
-- seeds, the UPDATE merges the key into the singleton that already exists.

alter table public.app_config
  add column if not exists controls_config jsonb not null default jsonb_build_object(
    'defaultHoldHours', 3,
    'defaultBonusPct', 5,
    'maxHoldHours', 72,
    'minHoldHours', 0
  );

update public.app_config
set controls_config = jsonb_build_object(
      'defaultHoldHours', 3,
      'defaultBonusPct', 5,
      'maxHoldHours', 72,
      'minHoldHours', 0
    ) || coalesce(controls_config, '{}'::jsonb)
where id = 1;

comment on column public.app_config.controls_config is
  'Wallet Credits controls, owned by admin console > Configurations > Controls. defaultHoldHours (3) is the hold a place INHERITS when it has set none - a fallback, not a flat rule; a place may hold longer up to maxHoldHours (72) to justify a bigger bonus. defaultBonusPct (5) applies the same way. minHoldHours ships unrendered: no reader yet. Read by admin-web-get/update-controls-config and consumer-web-get-controls-config.';

-- Post-flight: the column and its four keys must exist, or this apply aborts
-- before any EF starts reading a shape that is not there.
do $$
declare
  cfg jsonb;
begin
  select controls_config into cfg from public.app_config where id = 1;
  if cfg is null then
    raise exception 'app_config.controls_config missing after add';
  end if;
  if not (cfg ? 'defaultHoldHours' and cfg ? 'defaultBonusPct'
          and cfg ? 'maxHoldHours' and cfg ? 'minHoldHours') then
    raise exception 'app_config.controls_config is missing a key: %', cfg;
  end if;
end $$;

notify pgrst, 'reload schema';
