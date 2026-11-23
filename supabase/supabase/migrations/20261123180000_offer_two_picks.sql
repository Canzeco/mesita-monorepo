-- MESITA-4764 — TWO PICKS PER OFFER. Pato, 2026-11-23, over Business › Offers:
--   visits    welcome: 10% back or 20% back · returning: 5% back or 10% back
--   vouchers  small: 10% 20% · mid 20 40 · big 40 60
--   story     20 40
--
-- 1. place_cashback_settings and cashback_defaults: welcome_bps is one of
--    0 (Off) · 1000 · 2000, returning_bps 0 · 500 · 1000, story_reward_cents
--    0 · 2000 · 4000. Saved values outside them move to the nearest pick
--    (Welcome 500 → 1000, 1500 → 2000; Returning 1500 and 2000 → 1000;
--    Story 5000 → 4000). A story already verified keeps the amount it stored.
-- 2. Three new columns, the bonus each prepaid voucher gives at the place:
--    small_bonus_bps (voucher_200) 1000 · 2000, medium_bonus_bps
--    (voucher_1000) 2000 · 4000, big_bonus_bps (voucher_5000) 4000 · 6000;
--    the lower pick is the default. The EFs read them (_shared/cashback.ts,
--    _shared/vouchers.ts) and store the bonus on each purchase row at buy
--    time, so a change never moves a voucher already bought.
--
-- Rollback: drop the three columns; restore the old checks (0, 500, 1000,
-- 1500, 2000 for both rates; 0, 2000, 5000 for the story). The remapped
-- values stay valid under the old checks.

-- ── 1. The visit and story picks ─────────────────────────────────────────────
do $$
declare
  t text;
  c record;
begin
  foreach t in array array['place_cashback_settings', 'cashback_defaults'] loop
    for c in
      select con.conname
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and rel.relname = t and con.contype = 'c'
         and (pg_get_constraintdef(con.oid) ~ 'welcome_bps'
           or pg_get_constraintdef(con.oid) ~ 'returning_bps'
           or pg_get_constraintdef(con.oid) ~ 'regular_bps'
           or pg_get_constraintdef(con.oid) ~ 'story_reward_cents')
    loop
      execute format('alter table public.%I drop constraint %I', t, c.conname);
    end loop;
  end loop;
end $$;

update public.place_cashback_settings
   set welcome_bps = case when welcome_bps = 500 then 1000 when welcome_bps > 1000 then 2000 else welcome_bps end,
       returning_bps = least(returning_bps, 1000),
       story_reward_cents = least(story_reward_cents, 4000)
 where welcome_bps not in (0, 1000, 2000) or returning_bps not in (0, 500, 1000) or story_reward_cents not in (0, 2000, 4000);

update public.cashback_defaults
   set welcome_bps = case when welcome_bps = 500 then 1000 when welcome_bps > 1000 then 2000 else welcome_bps end,
       returning_bps = least(returning_bps, 1000),
       story_reward_cents = least(story_reward_cents, 4000)
 where welcome_bps not in (0, 1000, 2000) or returning_bps not in (0, 500, 1000) or story_reward_cents not in (0, 2000, 4000);

alter table public.place_cashback_settings
  add constraint place_cashback_settings_welcome_bps_check check (welcome_bps in (0, 1000, 2000)),
  add constraint place_cashback_settings_returning_bps_check check (returning_bps in (0, 500, 1000)),
  add constraint place_cashback_settings_story_reward_check check (story_reward_cents in (0, 2000, 4000));
alter table public.cashback_defaults
  add constraint cashback_defaults_welcome_bps_check check (welcome_bps in (0, 1000, 2000)),
  add constraint cashback_defaults_returning_bps_check check (returning_bps in (0, 500, 1000)),
  add constraint cashback_defaults_story_reward_check check (story_reward_cents in (0, 2000, 4000));

comment on column public.place_cashback_settings.story_reward_cents is
  'MESITA-4714, MESITA-4764: what a verified Instagram story tagging @mesita and this place pays the guest, in the place''s currency cents: 0 (Off), 2000 or 4000. Paid only where Loyalty Cards is On (story_reward_grant).';
comment on column public.cashback_defaults.story_reward_cents is
  'MESITA-4714, MESITA-4764: the story reward every place without its own place_cashback_settings row reads: 0 (Off), 2000 or 4000 cents.';

-- ── 2. The voucher bonuses ───────────────────────────────────────────────────
alter table public.place_cashback_settings
  add column if not exists small_bonus_bps integer not null default 1000
    constraint place_cashback_settings_small_bonus_check check (small_bonus_bps in (1000, 2000)),
  add column if not exists medium_bonus_bps integer not null default 2000
    constraint place_cashback_settings_medium_bonus_check check (medium_bonus_bps in (2000, 4000)),
  add column if not exists big_bonus_bps integer not null default 4000
    constraint place_cashback_settings_big_bonus_check check (big_bonus_bps in (4000, 6000));
alter table public.cashback_defaults
  add column if not exists small_bonus_bps integer not null default 1000
    constraint cashback_defaults_small_bonus_check check (small_bonus_bps in (1000, 2000)),
  add column if not exists medium_bonus_bps integer not null default 2000
    constraint cashback_defaults_medium_bonus_check check (medium_bonus_bps in (2000, 4000)),
  add column if not exists big_bonus_bps integer not null default 4000
    constraint cashback_defaults_big_bonus_check check (big_bonus_bps in (4000, 6000));

comment on column public.place_cashback_settings.small_bonus_bps is
  'MESITA-4764: the Small voucher''s (voucher_200) bonus at this place, basis points of the price: 1000 or 2000. Stored on each purchase at buy time.';
comment on column public.place_cashback_settings.medium_bonus_bps is
  'MESITA-4764: the Medium voucher''s (voucher_1000) bonus at this place, basis points of the price: 2000 or 4000. Stored on each purchase at buy time.';
comment on column public.place_cashback_settings.big_bonus_bps is
  'MESITA-4764: the Big voucher''s (voucher_5000) bonus at this place, basis points of the price: 4000 or 6000. Stored on each purchase at buy time.';
comment on column public.cashback_defaults.small_bonus_bps is
  'MESITA-4764: the Small voucher bonus every place without its own row reads: 1000 or 2000.';
comment on column public.cashback_defaults.medium_bonus_bps is
  'MESITA-4764: the Medium voucher bonus every place without its own row reads: 2000 or 4000.';
comment on column public.cashback_defaults.big_bonus_bps is
  'MESITA-4764: the Big voucher bonus every place without its own row reads: 4000 or 6000.';
