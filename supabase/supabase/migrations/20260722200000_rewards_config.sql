-- Rewards config — the six-segment reward grid (Promos v5, MESITA-723).
--
-- Backs the admin console's Rewards Config page (admin.mesita.ai/rewards-config)
-- via admin-web-get-rewards-config / admin-web-update-rewards-config.
--
-- The canonical v5 rate table (locked by Pato 2026-07-22) is hardcoded in the
-- web apps' business/strategies.ts today. This lifts it onto the app_settings
-- singleton so an operator can tune, per posture (Zero / Conservative /
-- Aggressive — Dominant retired in v5), what each of the six segments pays:
-- Standard · Magnetic · Premium · Instagram Story · Welcome Visit · Google
-- Review. A guest is paid their single best qualifying rung (best-of, never a
-- sum); the grid runs on 5% steps, floor 10%, ceiling 50% (0 = off, and the
-- Zero posture is off by definition). `cap` is the universal monthly_promo_cap:
-- every discount applies to the first `cap` MXN of the bill.
--
-- Convention mirrors the Sourcing / Reservations / Memo knobs: config lives on
-- the single-row public.app_settings (id = 1, RLS-enabled, no policies →
-- EF-only). Adding the column to the existing row resolves to the locked v5
-- defaults below with no data migration.
--
-- Enforcement: persists ahead of the engine. The v5 best-of resolution
-- (replacing selectProjectRate in _shared/membership.ts) reads this grid once it
-- ships; until then the live bill applies the v4 per-tier rate columns. Keys are
-- the contract shared with the admin catalog + apps/web-consumer reward-segments.

alter table public.app_settings
  add column if not exists rewards_config jsonb not null default $rewards$
{
  "cap": 500,
  "grid": {
    "standard": { "zero": 0, "conservative": 10, "aggressive": 10 },
    "magnetic": { "zero": 0, "conservative": 15, "aggressive": 20 },
    "premium":  { "zero": 0, "conservative": 15, "aggressive": 20 },
    "story":    { "zero": 0, "conservative": 20, "aggressive": 30 },
    "welcome":  { "zero": 0, "conservative": 20, "aggressive": 30 },
    "review":   { "zero": 0, "conservative": 30, "aggressive": 50 }
  }
}
$rewards$::jsonb;
