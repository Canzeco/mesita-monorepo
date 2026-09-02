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
// NOT here, deliberately: whether Credits may settle a bill at all. That is
// `visits_config.payCredits`, it already exists, and it answers a different
// question (which rails are open) for a different engine. Two knobs meaning
// one thing is how they drift apart.

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
};

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
 * Guest-facing slice — rides consumer-web-get-controls-config. The ceiling and
 * the floor are operator policy about what a PLACE may choose; a guest reads
 * the hold on their own card, not the range a venue was allowed to pick from.
 */
export type GuestControlsPolicy = {
  defaultHoldHours: number;
  defaultBonusPct: number;
};

export function guestControlsPolicy(c: ControlsConfig): GuestControlsPolicy {
  return {
    defaultHoldHours: c.defaultHoldHours,
    defaultBonusPct: c.defaultBonusPct,
  };
}
