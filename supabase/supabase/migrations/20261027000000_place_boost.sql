-- MESITA-2789 — Boost replaces Spotlight (MESITA-1998). Same machinery
-- (many guests back one place, each with their own Stripe subscription;
-- the place holds the tier its live backings pay for together), renamed
-- and re-tiered while no backing exists yet (0 rows on 2026-10-26):
--
--   Boost 2x  $10/mo · Boost 5x $50/mo · Boost 10x $200/mo
--   yearly = ten months for twelve ($100 · $500 · $2,000), so a yearly
--   backing counts a TENTH a month toward the tier.
--
-- Paid, never verified, never Selected: `places.selected` stays the
-- operator's mark. Prices live in _shared/boost.ts; the thresholds below
-- are those three monthly numbers — change both together.

-- ── Backings: the three tiers ────────────────────────────────────────────
alter table public.place_backings drop constraint if exists place_backings_tier_check;
alter table public.place_backings
  add constraint place_backings_tier_check
  check (tier in ('boost_2x', 'boost_5x', 'boost_10x'));

comment on table public.place_backings is
  'MESITA-2789 Boost (was Spotlight, MESITA-1998): one guest''s Stripe subscription backing one place''s paid tier. Many per place; places.boost_tier is derived from the live ones. EF-only (RLS, no policies; client privileges revoked).';

-- ── The derived tier: spotlight_tier → boost_tier, 0..3 ──────────────────
-- A column rename keeps its grants (column privileges follow the column).
alter table public.places rename column spotlight_tier to boost_tier;
alter table public.places drop constraint if exists places_spotlight_tier_check;
alter table public.places
  add constraint places_boost_tier_check check (boost_tier between 0 and 3);

comment on column public.places.boost_tier is
  'MESITA-2789 Boost: 0 none, 1 Boost 2x, 2 Boost 5x, 3 Boost 10x — the highest tier whose monthly price the place''s live backings (place_backings, active or trialing, period not ended) cover together, a yearly backing counted as a tenth a month. Written only by the place_backings trigger. Paid, never verified; independent of places.selected. The Area score multiplies by 2 · 5 · 10 (never stacked on Selected).';

-- The browse view follows the base column; its output name is renamed too.
alter view public.profiles rename column spotlight_tier to boost_tier;

-- ── Recompute ────────────────────────────────────────────────────────────
create or replace function public.recompute_place_boost(p_place_id uuid)
 returns smallint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cents numeric;
  v_tier smallint;
begin
  select coalesce(sum(
           case when b.billing_interval = 'year' then b.amount_cents / 10.0
                else b.amount_cents end), 0)
    into v_cents
    from public.place_backings b
   where b.place_id = p_place_id
     and b.status in ('active', 'trialing')
     and b.current_period_end > now();

  v_tier := case when v_cents >= 20000 then 3
                 when v_cents >= 5000 then 2
                 when v_cents >= 1000 then 1
                 else 0 end;

  update public.places
     set boost_tier = v_tier
   where id = p_place_id
     and boost_tier is distinct from v_tier;

  return v_tier;
end;
$function$;

revoke all on function public.recompute_place_boost(uuid) from public;
revoke execute on function public.recompute_place_boost(uuid) from anon, authenticated;

create or replace function public.place_backings_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recompute_place_boost(old.place_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.place_id <> old.place_id) then
    perform public.recompute_place_boost(new.place_id);
  end if;
  return null;
end;
$function$;

drop function if exists public.recompute_place_spotlight(uuid);

-- ── Keep status and period from Stripe: the job follows the EF rename ────
-- Kill switch: select cron.unschedule('sync-boosts');
select cron.unschedule('sync-spotlights')
where exists (select 1 from cron.job where jobname = 'sync-spotlights');
select cron.unschedule('sync-boosts')
where exists (select 1 from cron.job where jobname = 'sync-boosts');

select cron.schedule(
  'sync-boosts',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-sync-boosts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
