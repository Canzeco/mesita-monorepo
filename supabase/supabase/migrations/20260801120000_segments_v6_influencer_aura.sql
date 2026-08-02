-- Segments v6 (2026-08-01): magnetism splits into its two real products.
--
-- The Magnetic class retires. In its place:
--   • influencer — the digital-reach class. Instagram ≥ 1,000 followers,
--     granted automatically by consumer-web-claim-instagram (data-driven off
--     follower_threshold). The Instagram Story rung becomes this class's
--     EXCLUSIVE action.
--   • aura — the invite-only local-presence class (origin 'invitation',
--     granted via admin-web-grant-class). Highest flat class rung; paid for
--     presence, no posting required.
--
-- One tier per class for launch; future tiers (Aura Gold, reach bands) are
-- deliberate INSERTs — the EF engine resolves class segments generically.
-- Ladder: standard(0) < premium(1) < influencer(2) < aura(3).
-- Grid: 7 segments (4 class + story/welcome/review), best-of, cap unchanged.

-- 1) Park the retiring row's rank (rank is UNIQUE; influencer takes 2).
update public.classes set rank = 99 where key = 'magnetic';

-- 2) Seed the two new classes.
insert into public.classes
  (key, label, rank, follower_threshold, monthly_reservation_limit, price_cents, currency, recommendation_weight)
values
  ('influencer', 'Influencer', 2, 1000, 10, 0, 'MXN', 1.5),
  ('aura',       'Aura',       3, null, 10, 0, 'MXN', 1.5)
on conflict (key) do update set
  label                     = excluded.label,
  rank                      = excluded.rank,
  follower_threshold        = excluded.follower_threshold,
  monthly_reservation_limit = excluded.monthly_reservation_limit,
  price_cents               = excluded.price_cents,
  currency                  = excluded.currency,
  recommendation_weight     = excluded.recommendation_weight;

-- 3) Re-point any magnetic consumers (zero rows live today; replay-safe), then
--    retire the row.
update public.consumers set class_key = 'influencer' where class_key = 'magnetic';
delete from public.classes where key = 'magnetic';

-- 4) Reshape the live rewards grid: drop the magnetic row, add influencer +
--    aura (v6 defaults). Every other cell keeps its operator-tuned value.
update public.app_settings
set rewards_config = jsonb_set(
  rewards_config,
  '{grid}',
  (rewards_config->'grid') - 'magnetic'
    || '{
          "influencer": { "zero": 0, "conservative": 15, "aggressive": 20 },
          "aura":       { "zero": 0, "conservative": 20, "aggressive": 25 }
        }'::jsonb
)
where id = 1;

-- 5) Update the column DEFAULT to the 7-key shape (the 20260722200000 default
--    still carries 'magnetic'; a fresh environment must not re-seed it).
alter table public.app_settings
  alter column rewards_config set default $rewards$
{
  "cap": 500,
  "grid": {
    "standard":   { "zero": 0, "conservative": 10, "aggressive": 10 },
    "premium":    { "zero": 0, "conservative": 15, "aggressive": 20 },
    "influencer": { "zero": 0, "conservative": 15, "aggressive": 20 },
    "aura":       { "zero": 0, "conservative": 20, "aggressive": 25 },
    "story":      { "zero": 0, "conservative": 20, "aggressive": 30 },
    "welcome":    { "zero": 0, "conservative": 20, "aggressive": 30 },
    "review":     { "zero": 0, "conservative": 30, "aggressive": 50 }
  }
}
$rewards$::jsonb;

-- 6) Surgically patch admin_reset_database's classes seed (never re-declare
--    the function wholesale — string-replace off the live definition, raise if
--    the target text drifted).
do $patch$
declare
  src text;
  patched text;
begin
  select pg_get_functiondef(oid) into src
  from pg_proc
  where proname = 'admin_reset_database'
    and pronamespace = 'public'::regnamespace;

  if src is null then
    raise exception 'admin_reset_database not found';
  end if;

  patched := replace(
    src,
    $seed$('magnetic', 'Magnetic', 2, 5000, 10,   0,     'MXN', 1.5)$seed$,
    $seed$('influencer', 'Influencer', 2, 1000, 10, 0,   'MXN', 1.5),
    ('aura',       'Aura',       3, null, 10, 0,   'MXN', 1.5)$seed$
  );

  if patched = src then
    raise exception 'admin_reset_database patch target not found — function text drifted; update the migration';
  end if;

  execute patched;
end;
$patch$;

notify pgrst, 'reload schema';
