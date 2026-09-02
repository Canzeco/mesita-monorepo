// Controls config shape + defaults. Deliberately NOT in actions.ts: that file
// is "use server", and a Server Actions module may export only async functions
// — a const export there fails Next's page-data collection at build time.
// Mirrors supabase/functions/_shared/controls-config.ts, which is authoritative.

export type ControlsConfig = {
  defaultHoldHours: number;
  defaultBonusPct: number;
  maxHoldHours: number;
  /** Unrendered: no reader for a floor yet. Round-trips on save. */
  minHoldHours: number;
  /** DAYS from a top-up until unspent Credits expire. Not hours — see the page. */
  defaultExpiryDays: number;
  /** DAYS. The shortest life a place may sell: a FLOOR, where the hold has a ceiling. */
  minExpiryDays: number;
};

export const CONTROLS_FALLBACK: ControlsConfig = {
  defaultHoldHours: 3,
  defaultBonusPct: 5,
  maxHoldHours: 72,
  minHoldHours: 0,
  defaultExpiryDays: 90,
  minExpiryDays: 30,
};
