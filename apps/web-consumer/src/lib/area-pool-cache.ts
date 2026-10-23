// Places keeps each location's ranked Area pool for a few minutes
// (MESITA-2384), so a family change, a later page or a return to a location
// spends no request and buys no Google call. The server returns the whole
// ranked pool once; this is the only cache of it, in this tab's memory —
// nothing is written to storage, and it never outlives ten minutes.

import type { AreaPool } from "@/lib/api/places";

export const AREA_POOL_TTL_MS = 10 * 60 * 1000;

/** Which pool a location reads: GPS drift inside ~1 km keeps the key. The
 *  radius is part of the question (MESITA-2703): `r:op` for the operator's
 *  current-location radius, `r:<km>` for a pin's own or a widened search. */
export function areaPoolKey(
  origin: { key?: string; lat: number; lng: number; radiusKm?: number | null } | null,
): string {
  if (!origin) return "none";
  const r = typeof origin.radiusKm === "number" && Number.isFinite(origin.radiusKm)
    ? `r:${origin.radiusKm.toFixed(1)}`
    : "r:op";
  // A saved pin keys by its id AND where it stands (MESITA-2501): moving the
  // pin is a new question, a renamed pin is not.
  if (origin.key) return `${origin.key}@${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${r}`;
  return `current:${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}|${r}`;
}

const pools = new Map<string, { at: number; pool: AreaPool }>();

export function readAreaPool(key: string, now = Date.now()): AreaPool | null {
  const hit = pools.get(key);
  if (!hit) return null;
  if (now - hit.at >= AREA_POOL_TTL_MS) {
    pools.delete(key);
    return null;
  }
  return hit.pool;
}

export function writeAreaPool(key: string, pool: AreaPool, now = Date.now()): void {
  pools.set(key, { at: now, pool });
}
