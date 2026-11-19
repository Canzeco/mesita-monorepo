// The Catalog rank's request fields (MESITA-4454, DX-c, L-4): which question
// Home asks (`rankMode`), the first-page shuffle's seed (`shuffleSeed`) and
// the point the seed was made at (`seedLat` / `seedLng`, M-a). Pure, so the
// EF validates before any read and the tests pin the 400s.

import { decideNearby } from "./geo.ts";
import { isRankMode, type RankMode } from "./pipeline-signals.ts";

export type LatLngPoint = { lat: number; lng: number };

/** `rankMode`, or the default: `familyKeys` → family, else popular. Absent
 *  is `undefined` or `null`; anything else that is not a mode is refused. */
export function readRankMode(
  raw: unknown,
  familyKeys: readonly string[],
): { ok: true; rankMode: RankMode } | { ok: false; got: unknown } {
  if (raw === undefined || raw === null) {
    return { ok: true, rankMode: familyKeys.length > 0 ? "family" : "popular" };
  }
  return isRankMode(raw) ? { ok: true, rankMode: raw } : { ok: false, got: raw };
}

export const SHUFFLE_SEED_MAX = 2 ** 32 - 1;

/** `shuffleSeed`: an integer 0…2^32 − 1 (0 is valid); absent draws one. */
export function readShuffleSeed(
  raw: unknown,
  draw: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0],
): { ok: true; seed: number; sent: boolean } | { ok: false; got: unknown } {
  if (raw === undefined || raw === null) return { ok: true, seed: draw() >>> 0, sent: false };
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= SHUFFLE_SEED_MAX) {
    return { ok: true, seed: raw, sent: true };
  }
  return { ok: false, got: raw };
}

/** The seed's point (M-a), when both `seedLat` and `seedLng` are a valid
 *  pair; otherwise null and the request's own `lat` / `lng` rank. */
export function readSeedPoint(body: Record<string, unknown>): LatLngPoint | null {
  const d = decideNearby({ lat: body.seedLat, lng: body.seedLng });
  return d.mode === "ok" ? { lat: d.lat, lng: d.lng } : null;
}
