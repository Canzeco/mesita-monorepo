// Controls config — the Wallet's Credits policy: how long a prepaid balance
// sits held before a guest can spend it, and what the place pays for that hold.
//
// A FALLBACK, NOT A FLAT RULE (Pato, 2026-09-01). `defaultHoldHours` is what a
// place inherits when it has set no hold of its own — today that is every
// place. A place may still hold LONGER to justify a bigger bonus, up to
// `maxHoldHours`, because the pairing is the model: what the place buys is
// float, and the bonus is the rate it pays for it. A flat global hold would
// leave the bonus priced against nothing.
//
// `minHoldHours` ships in the blob and NOT on the page. There is no reader for
// a floor yet, and only WIRED knobs render (Discovery law) — but the whole-blob
// save carries it, so a later reader sees the operator's stored value rather
// than a default that quietly replaced it.
//
// CREDITS EXPIRE, AND EXPIRY IS COUNTED IN DAYS (Pato, 2026-09-02). The hold is
// an afternoon; the life of the instrument is a season, and a knob whose unit
// forces "2160 hours" is a knob that will be mistyped. `defaultExpiryDays` (90)
// is what a place inherits, running from the top-up, not from maturity.
//
// THE EXPIRY GUARD IS A FLOOR, NOT A CEILING — the mirror image of the hold's.
// A LONGER hold is the term a guest suffers, so the operator caps it; a SHORTER
// expiry is, so the operator sets the shortest life a place may sell:
// `minExpiryDays` (30). The two guards point opposite ways because they defend
// the same person.
//
// NOT here, deliberately: whether Credits may settle a bill at all. That is
// `visits_config.payCredits`, it already exists, and it answers a different
// question (which rails are open) for a different engine. Two knobs meaning
// one thing is how they drift apart.
//
// Also NOT decided here: what happens to the REMAINDER when a balance expires
// — forfeited to the place, or the paid half returned. That is a settlement
// question with no book behind it, and expiry stops the money being spendable
// without answering it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type ControlsConfig = {
  /** Hours a top-up is held before it can be spent, when the place sets none. */
  defaultHoldHours: number;
  /** Bonus a top-up earns, as a whole percent, when the place sets none. */
  defaultBonusPct: number;
  /** Ceiling on a per-place hold override. No venue locks money indefinitely. */
  maxHoldHours: number;
  /** Floor on a per-place hold override. Unrendered: no reader yet. */
  minHoldHours: number;
  /** Days from a top-up until unspent Credits expire, when the place sets none. */
  defaultExpiryDays: number;
  /** Floor on a per-place expiry override. No venue sells Credits that die young. */
  minExpiryDays: number;
};

export const CONTROLS_DEFAULTS: ControlsConfig = {
  // Three hours (Pato, 2026-09-01). Long enough to be a hold the place can
  // price a bonus against, short enough that Credits bought at lunch are
  // spendable at dinner — the same visit, which is when a guest wants them.
  defaultHoldHours: 3,
  defaultBonusPct: 5,
  // Three days. Past this a prepay stops reading as a term deposit and starts
  // reading as money the guest cannot get back.
  maxHoldHours: 72,
  minHoldHours: 0,
  // Ninety days (Pato, 2026-09-02: "it must be a lot"). A guest who prepays a
  // place they like eats there monthly, not weekly, so a life measured in weeks
  // would expire money that was always going to be spent — and the first thing
  // a guest learns about the instrument would be that it evaporates. A quarter
  // outlasts the gap between visits with room to spare.
  defaultExpiryDays: 90,
  // Thirty days is the shortest life a place may sell. A month still buys the
  // place its breakage story; anything under it and the bonus is paying for an
  // expiry the guest cannot realistically beat.
  minExpiryDays: 30,
};

/** Hours in a day. Expiry is set in days and the hold in hours; they compare here. */
const HOURS_PER_DAY = 24;

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Tolerant read: any missing/invalid key falls back to its default. */
export function normalizeControlsConfig(raw: unknown): ControlsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const minHold = Math.round(
    num(r.minHoldHours, CONTROLS_DEFAULTS.minHoldHours, 0, 720),
  );
  // The ceiling can never sit below the floor, or the range it describes is
  // empty and every per-place override would clamp to a contradiction.
  const maxHold = Math.max(
    minHold,
    Math.round(num(r.maxHoldHours, CONTROLS_DEFAULTS.maxHoldHours, 0, 720)),
  );
  // CREDITS MAY NEVER EXPIRE BEFORE THEY MATURE. The floor is raised to cover
  // the longest hold a place could set, so no combination of these knobs can
  // sell a guest money that is locked for its entire life. Ten years is the
  // outer bound on either expiry value — past that it is not a term, it is a
  // typo, and 3650 keeps the day/hour arithmetic inside safe integers.
  const minExpiry = Math.max(
    Math.ceil(maxHold / HOURS_PER_DAY),
    Math.round(num(r.minExpiryDays, CONTROLS_DEFAULTS.minExpiryDays, 0, 3650)),
  );
  // Same argument as the default hold: an operator who raises the floor must
  // not strand the default under it, or every place would inherit a life its
  // own overrides are forbidden to sell.
  const defaultExpiry = Math.max(
    minExpiry,
    Math.round(
      num(r.defaultExpiryDays, CONTROLS_DEFAULTS.defaultExpiryDays, 0, 3650),
    ),
  );
  return {
    // The default has to be a hold a place could actually be given, so it is
    // clamped INTO the [min, max] window rather than validated against it.
    // An operator who narrows the window must not strand the default outside.
    defaultHoldHours: Math.min(
      maxHold,
      Math.max(
        minHold,
        Math.round(
          num(r.defaultHoldHours, CONTROLS_DEFAULTS.defaultHoldHours, 0, 720),
        ),
      ),
    ),
    defaultBonusPct: Math.round(
      num(r.defaultBonusPct, CONTROLS_DEFAULTS.defaultBonusPct, 0, 100),
    ),
    maxHoldHours: maxHold,
    minHoldHours: minHold,
    defaultExpiryDays: defaultExpiry,
    minExpiryDays: minExpiry,
  };
}

/**
 * The hold a place actually gets. `placeHoldHours` is the place's own override
 * (null when it has set none), clamped into the operator's window.
 */
export function resolveHoldHours(
  config: ControlsConfig,
  placeHoldHours: number | null | undefined,
): number {
  if (typeof placeHoldHours !== "number" || !Number.isFinite(placeHoldHours)) {
    return config.defaultHoldHours;
  }
  return Math.min(
    config.maxHoldHours,
    Math.max(config.minHoldHours, Math.round(placeHoldHours)),
  );
}

/**
 * The expiry a place actually gets, in days from the top-up. `placeExpiryDays`
 * is the place's own override (null when it has set none), floored at the
 * operator's minimum. There is no ceiling: a place that wants to sell Credits
 * that outlive the policy is giving the guest more than was promised.
 *
 * Zero is NOT a live override the way `resolveHoldHours(…, 0)` is. A hold of
 * zero is instant-use Credits, a real product; an expiry of zero is money that
 * dies on purchase, so it floors like any other too-short value.
 */
export function resolveExpiryDays(
  config: ControlsConfig,
  placeExpiryDays: number | null | undefined,
): number {
  if (
    typeof placeExpiryDays !== "number" || !Number.isFinite(placeExpiryDays)
  ) {
    return config.defaultExpiryDays;
  }
  return Math.max(config.minExpiryDays, Math.round(placeExpiryDays));
}

/** Load the live blob, or the defaults if the row cannot be read. */
export async function loadControlsConfig(
  admin: SupabaseClient,
): Promise<ControlsConfig> {
  try {
    const { data, error } = await admin
      .from("app_config")
      .select("controls_config")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("[controls-config] read:", error.message);
      return { ...CONTROLS_DEFAULTS };
    }
    return normalizeControlsConfig(
      (data as { controls_config?: unknown } | null)?.controls_config,
    );
  } catch (e) {
    console.error("[controls-config] read threw:", (e as Error).message);
    return { ...CONTROLS_DEFAULTS };
  }
}

/**
 * Guest-facing slice — rides consumer-web-get-controls-config. The hold window
 * and the expiry floor are operator policy about what a PLACE may choose; a
 * guest reads the terms on their own card, not the range a venue was allowed to
 * pick from. The expiry DEFAULT crosses, because a guest is owed the date their
 * own Credits die.
 */
export type GuestControlsPolicy = {
  defaultHoldHours: number;
  defaultBonusPct: number;
  defaultExpiryDays: number;
};

export function guestControlsPolicy(c: ControlsConfig): GuestControlsPolicy {
  return {
    defaultHoldHours: c.defaultHoldHours,
    defaultBonusPct: c.defaultBonusPct,
    defaultExpiryDays: c.defaultExpiryDays,
  };
}
