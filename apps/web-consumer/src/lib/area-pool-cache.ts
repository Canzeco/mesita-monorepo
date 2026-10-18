// Places keeps each location's ranked Area pool for a few minutes
// (MESITA-2384), so a family change, a later page or a return to a location
// spends no request and buys no Google call. The server returns the whole
// ranked pool once; this is the only cache of it, in this tab's memory —
// nothing is written to storage, and it never outlives ten minutes.

import type { AreaPool } from "@/lib/api/places";

export const AREA_POOL_TTL_MS = 10 * 60 * 1000;

/** Which pool a location reads: GPS drift inside ~1 km keeps the key. */
export function areaPoolKey(
  origin: { key?: string; lat: number; lng: number } | null,
): string {
  if (!origin) return "none";
  if (origin.key) return origin.key;
  return `current:${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}`;
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

/** A place was created behind the Feed: every cached pool may be stale. */
export function clearAreaPools(): void {
  pools.clear();
}
