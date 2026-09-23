// The Diamond List — the one place its vocabulary lives (MESITA-2044).
//
// Pato, 2026-09-22: "there are no classes, either you are diamond or you are
// not. its more like a List. Diamond List. you are in the list or you don't,
// not in between"
//
// A guest is ON the list or NOT. Storage keeps its names: on the list is
// `consumers.class_key = 'diamond'` (legacy `aura` bridges to it), everything
// else — `bronze`, a stray `silver`/`gold` row, a legacy key, null — is "not
// on the list". Only what a person READS changed, so this module owns the
// read side (onDiamondList, diamondListLabel) and the one write-side guard the
// grant endpoints share (parseListGrantKey).
//
// Invitation is the only way on: a named grant from Mesita, or a 10-digit
// PIN. Instagram grants nothing toward it (_shared/class-doors.ts).

import { identityForClassKey } from "./promos-normalize.ts";

/** The stored class key that means "on the Diamond List". */
export const DIAMOND_LIST_KEY = "diamond";

/** The name, exactly as every guest and staff surface prints it. */
export const DIAMOND_LIST_NAME = "Diamond List";

/**
 * True only for a guest on the list. A stray `silver`/`gold` slot is NOT on
 * the list — there is no in between.
 */
export function onDiamondList(classKey: string | null | undefined): boolean {
  return identityForClassKey(classKey).cls === DIAMOND_LIST_KEY;
}

/**
 * The display label for a profile payload: the list's name when on it, null
 * when not. Never a metal — the classes table's own `label` column still says
 * Bronze/Silver/Gold/Diamond and must not reach a person.
 */
export function diamondListLabel(
  classKey: string | null | undefined,
): string | null {
  return onDiamondList(classKey) ? DIAMOND_LIST_NAME : null;
}

export type ListGrantKey =
  | { ok: true; classKey: typeof DIAMOND_LIST_KEY | null }
  | { ok: false; error: string };

/**
 * Validate the `classKey` an invitation writer was sent. `diamond` puts a
 * guest on the list; `null` (only where the caller supports revoking) takes
 * them off. Anything else — the retired `silver`/`gold` rungs included — is
 * refused with a message an operator can act on, because granting a
 * half-way class would recreate the in-between the list abolished.
 */
export function parseListGrantKey(
  raw: unknown,
  opts: { allowRevoke: boolean },
): ListGrantKey {
  // null/absent is the revoke signal (the grant endpoint's original contract:
  // `classKey ?? null`). An empty string is a malformed grant, not a revoke.
  if (raw === null || raw === undefined) {
    return opts.allowRevoke
      ? { ok: true, classKey: null }
      : { ok: false, error: `classKey is required: send "${DIAMOND_LIST_KEY}".` };
  }
  const key = String(raw).trim().toLowerCase();
  if (!key) {
    return { ok: false, error: `classKey is empty: send "${DIAMOND_LIST_KEY}".` };
  }
  if (key === DIAMOND_LIST_KEY) return { ok: true, classKey: DIAMOND_LIST_KEY };
  const how = opts.allowRevoke
    ? `send "${DIAMOND_LIST_KEY}" to add a guest to the ${DIAMOND_LIST_NAME}, or null to remove them`
    : `send "${DIAMOND_LIST_KEY}"`;
  return {
    ok: false,
    error:
      `"${key}" can't be granted: the ${DIAMOND_LIST_NAME} is the only invitation. Guests are on it or not — ${how}.`,
  };
}
