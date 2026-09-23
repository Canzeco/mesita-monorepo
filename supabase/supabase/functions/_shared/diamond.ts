// Diamond — the one place its vocabulary lives (MESITA-2044, MESITA-2046).
//
// Pato, 2026-09-22: "there are no classes, either you are diamond or you are
// not". MESITA-2044 called it the Diamond List; MESITA-2046 cut the noun
// ("Don't call diamond list, just diamond").
//
// A guest is Diamond or NOT. Storage keeps its names: Diamond is
// `consumers.class_key = 'diamond'` (legacy `aura` bridges to it), everything
// else — `bronze`, a stray `silver`/`gold` row, a legacy key, null — is "not
// Diamond". Only what a person READS changed, so this module owns the
// read side (isDiamond, diamondLabel) and the one write-side guard the
// grant endpoints share (parseDiamondGrantKey).
//
// Invitation is the only way on: a named grant from Mesita, or a 10-digit
// PIN. Instagram grants nothing toward it (_shared/class-doors.ts).

import { identityForClassKey } from "./promos-normalize.ts";

/** The stored class key that means "Diamond". */
export const DIAMOND_KEY = "diamond";

/** The name, exactly as every guest and staff surface prints it. */
export const DIAMOND_NAME = "Diamond";

/**
 * True only for a Diamond guest. A stray `silver`/`gold` slot is NOT
 * Diamond — there is no in between.
 */
export function isDiamond(classKey: string | null | undefined): boolean {
  return identityForClassKey(classKey).cls === DIAMOND_KEY;
}

/**
 * The display label for a profile payload: the name when Diamond, null
 * when not. Never a metal — the classes table's own `label` column still says
 * Bronze/Silver/Gold/Diamond and must not reach a person.
 */
export function diamondLabel(
  classKey: string | null | undefined,
): string | null {
  return isDiamond(classKey) ? DIAMOND_NAME : null;
}

export type DiamondGrantKey =
  | { ok: true; classKey: typeof DIAMOND_KEY | null }
  | { ok: false; error: string };

/**
 * Validate the `classKey` an invitation writer was sent. `diamond` makes a
 * guest Diamond; `null` (only where the caller supports revoking) takes
 * them off. Anything else — the retired `silver`/`gold` rungs included — is
 * refused with a message an operator can act on, because granting a
 * half-way class would recreate the in-between Diamond abolished.
 */
export function parseDiamondGrantKey(
  raw: unknown,
  opts: { allowRevoke: boolean },
): DiamondGrantKey {
  // null/absent is the revoke signal (the grant endpoint's original contract:
  // `classKey ?? null`). An empty string is a malformed grant, not a revoke.
  if (raw === null || raw === undefined) {
    return opts.allowRevoke
      ? { ok: true, classKey: null }
      : { ok: false, error: `classKey is required: send "${DIAMOND_KEY}".` };
  }
  const key = String(raw).trim().toLowerCase();
  if (!key) {
    return { ok: false, error: `classKey is empty: send "${DIAMOND_KEY}".` };
  }
  if (key === DIAMOND_KEY) return { ok: true, classKey: DIAMOND_KEY };
  const how = opts.allowRevoke
    ? `send "${DIAMOND_KEY}" to make a guest ${DIAMOND_NAME}, or null to remove it`
    : `send "${DIAMOND_KEY}"`;
  return {
    ok: false,
    error:
      `"${key}" can't be granted: ${DIAMOND_NAME} is the only invitation. Guests are ${DIAMOND_NAME} or not — ${how}.`,
  };
}
