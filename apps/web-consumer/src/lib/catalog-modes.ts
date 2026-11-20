// HOME'S THREE QUESTIONS, EACH ITS OWN LIST (MESITA-4454, Discovery ranking
// v2). Nearby (chip `near`), Popular (chip `all`) and every family chip ask
// consumer-web-list-catalog their own `rankMode`; they no longer share one
// pool (MESITA-4423 had Near read Top's).
//
//   SEED   one per page load and mode (C2, DX-a), in memory only: a reload
//          draws a new feed (MESITA-4463, Pato: "if i reload, the feed must
//          be generated again"). Within one load the shuffle holds when the
//          guest comes back to a mode. It is made at a point (M-a) and that
//          point is sent (`seedLat` / `seedLng`) until the guest moves more
//          than 300 m; then a new seed at the new point. GPS drift never
//          reorders the list.
//   POOL   each mode's ranked answer (`order`, `adIds`, `preShuffle`, the
//          cards filled so far), in this tab's memory for the session (H3):
//          going back to a mode paints it at once, no request.
//   CONFIG a rank answers the config row's `updatedAt` (DX-b); when it
//          differs from the one this tab last saw, every mode's pool and seed
//          are dropped, since every order was ranked under old numbers.
//
// Pure functions plus two small stores, React-free (lib/api/places.ts
// imports it and must stay server-safe); Home reads the pools through
// `subscribeModePools` with useSyncExternalStore.

import type { AreaOrigin, AreaPool, Place } from "@/lib/api/places";
import { haversineKm } from "@/lib/utils";

/** The three questions Home asks (Names: Nearby · Popular · Family). */
export type RankMode = "nearby" | "popular" | "family";

/** A Home chip's key → its mode (DX-c): `near` → nearby, `all` → popular,
 *  any family key → family. Stored chip keys are never renamed.
 *  TWIN of `rankModeForChip` in
 *  supabase/supabase/functions/_shared/pipeline-signals.ts (this app cannot
 *  import _shared; `catalog-modes.test.ts` pins the two bodies equal). */
export function rankModeForChip(key: string): RankMode {
  if (key === "near") return "nearby";
  if (key === "all") return "popular";
  return "family";
}

/** One cache slot per question: the mode, and the family for a family row. */
export function modeKey(rankMode: RankMode, familyKeys: readonly string[]): string {
  return rankMode === "family" ? `family:${familyKeys.join(",")}` : rankMode;
}

/** A move past this re-seeds the mode (C2): a new seed at the new point. */
export const RESEED_KM = 0.3;

/** The seed a mode ranks with and the point it was made at. */
export type SeedRecord = { seed: number; point: AreaOrigin | null };

type StoredSeed = { seed: number; lat: number | null; lng: number | null };
type Stored = {
  /** The config `updatedAt` this tab last saw; undefined = none yet. */
  updatedAt?: string | null;
  seeds: Record<string, StoredSeed>;
};

// Memory only (MESITA-4463): nothing survives a reload, so every page load
// shuffles anew. The `mesita.catalog-modes.v1` sessionStorage key a build
// before 2026-11-19 wrote is never read again.
let mem: Stored | null = null;

function load(): Stored {
  if (!mem) mem = { seeds: {} };
  return mem;
}

/** A uint32 for the shuffle (DX-a; 0 is valid). */
export function drawSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
  } catch {
    return Math.floor(Math.random() * 0x100000000) >>> 0;
  }
}

function pointOf(s: StoredSeed): AreaOrigin | null {
  return s.lat !== null && s.lng !== null ? { lat: s.lat, lng: s.lng } : null;
}

/** The seed this mode ranks with from `here` (C2, M-a): the stored one while
 *  the guest stays within 300 m of its point (or has no point now); a seed
 *  made with no point takes the first point that arrives; none yet, or a
 *  move past 300 m, draws a new one at `here`. Writes what it decides. */
export function seedFor(
  key: string,
  here: AreaOrigin | null,
  draw: () => number = drawSeed,
): SeedRecord {
  const s = load();
  const cur = s.seeds[key];
  if (cur) {
    const point = pointOf(cur);
    if (point === null && here === null) return { seed: cur.seed, point: null };
    if (point !== null && here === null) return { seed: cur.seed, point };
    if (point !== null && here !== null) {
      if (haversineKm(point.lat, point.lng, here.lat, here.lng) <= RESEED_KM) {
        return { seed: cur.seed, point };
      }
    } else if (point === null && here !== null) {
      s.seeds[key] = { seed: cur.seed, lat: here.lat, lng: here.lng };
      return { seed: cur.seed, point: { lat: here.lat, lng: here.lng } };
    }
  }
  const next: SeedRecord = {
    seed: draw() >>> 0,
    point: here ? { lat: here.lat, lng: here.lng } : null,
  };
  s.seeds[key] = { seed: next.seed, lat: next.point?.lat ?? null, lng: next.point?.lng ?? null };
  return next;
}

// ── Pools: memory only, one per guest × mode ───────────────────────────

type PoolEntry = { seed: number; point: AreaOrigin | null; pool: AreaPool };
const pools = new Map<string, PoolEntry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function slot(guest: string, key: string): string {
  return `${guest}|${key}`;
}

function samePoint(a: AreaOrigin | null, b: AreaOrigin | null): boolean {
  if (a === null || b === null) return a === b;
  return a.lat === b.lat && a.lng === b.lng;
}

/** The mode's pool, whatever seed it was ranked with (what Home paints). */
export function readModePool(guest: string, key: string): AreaPool | null {
  return pools.get(slot(guest, key))?.pool ?? null;
}

/** The mode's pool only when it was ranked with `rec` (else re-rank). */
export function modePoolFor(guest: string, key: string, rec: SeedRecord): AreaPool | null {
  const hit = pools.get(slot(guest, key));
  return hit && hit.seed === rec.seed && samePoint(hit.point, rec.point) ? hit.pool : null;
}

/** A rank's answer for a mode (DX-b): when its config `updatedAt` differs
 *  from the one this tab saw last, every mode's pool and seed are dropped
 *  first; then this mode keeps `rec` and `pool`. True when it dropped. */
export function acceptRank(
  guest: string,
  key: string,
  rec: SeedRecord,
  pool: AreaPool,
  updatedAt: string | null | undefined,
): boolean {
  const s = load();
  let dropped = false;
  if (updatedAt !== undefined) {
    if (s.updatedAt !== undefined && s.updatedAt !== updatedAt) {
      s.seeds = {};
      pools.clear();
      dropped = true;
    }
    s.updatedAt = updatedAt;
  }
  s.seeds[key] = { seed: rec.seed, lat: rec.point?.lat ?? null, lng: rec.point?.lng ?? null };
  pools.set(slot(guest, key), { seed: rec.seed, point: rec.point, pool });
  emit();
  return dropped;
}

/** Change a mode's kept pool in place (a fill landing). */
export function updateModePool(
  guest: string,
  key: string,
  fn: (cur: AreaPool) => AreaPool,
): void {
  const k = slot(guest, key);
  const hit = pools.get(k);
  if (!hit) return;
  const next = fn(hit.pool);
  if (next === hit.pool) return;
  pools.set(k, { ...hit, pool: next });
  emit();
}

/** Forget a mode's pool: the next look ranks again (a run of empty fills
 *  means the order went stale, MESITA-3057). The seed stays. */
export function dropModePool(guest: string, key: string): void {
  if (pools.delete(slot(guest, key))) emit();
}

/** Listen for any pool change (Home's useSyncExternalStore). */
export function subscribeModePools(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Tests only: forget every seed and pool (what a reload does). */
export function resetCatalogModes(): void {
  mem = null;
  pools.clear();
}

// ── The "Ad" mark (H4, M-d, M-7) ────────────────────────────────────────

/** A row wears "Ad" only when it sits in an ad slot: its id is in the rank's
 *  `adIds` (Home), or, with no rank list, the place itself says `ad: true`
 *  (a Map pin). A Premier place in an organic slot wears its seal only. */
export function isAdPlace(
  place: Pick<Place, "id" | "ad">,
  adIds?: ReadonlySet<string> | null,
): boolean {
  if (adIds) return adIds.has(place.id);
  return place.ad === true;
}

/** The ad-slot ids a rank answered (M-d, DX-h): a two-lane answer
 *  (`lanes: true`) without a valid `adIds` is refused (no ads, an error
 *  logged); an older answer without one has none. */
export function readRankAdIds(data: { lanes?: unknown; adIds?: unknown }): {
  adIds: string[];
  refused: boolean;
} {
  const ok = Array.isArray(data.adIds) && data.adIds.every((id) => typeof id === "string");
  if (ok) return { adIds: [...new Set(data.adIds as string[])], refused: false };
  return { adIds: [], refused: data.lanes === true };
}

/** A place shown this many times on Home sinks on the next rank (MESITA-4459). */
export const SEEN_OFTEN = 3;
const SEEN_STORE_CAP = 200;
const SEEN_SEND_CAP = 40;
const SEEN_KEY = "mesita.home-seen.v1";

/** Count one more showing. The oldest ids past the cap drop first. */
export function bumpSeen(
  prev: Readonly<Record<string, number>>,
  ids: readonly string[],
): Record<string, number> {
  const next: Record<string, number> = { ...prev };
  for (const id of ids) {
    if (!id) continue;
    next[id] = (next[id] ?? 0) + 1;
  }
  const keys = Object.keys(next);
  if (keys.length > SEEN_STORE_CAP) {
    for (const id of keys.slice(0, keys.length - SEEN_STORE_CAP)) delete next[id];
  }
  return next;
}

/** The ids shown at least SEEN_OFTEN times, most-shown first, capped. */
export function oftenSeen(counts: Readonly<Record<string, number>>): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n >= SEEN_OFTEN)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, SEEN_SEND_CAP)
    .map(([id]) => id);
}

function readSeenCounts(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(raw)) {
      if (typeof n === "number" && n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Ids to send on the next Home rank. */
export function oftenSeenIds(): string[] {
  return oftenSeen(readSeenCounts());
}

/** Remember the first page Home just painted. */
export function noteHomeSeen(ids: readonly string[]): void {
  if (typeof localStorage === "undefined" || ids.length === 0) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(bumpSeen(readSeenCounts(), ids)));
  } catch {
    // A full store only costs the next page its variety.
  }
}

/** "1st", "2nd", "3rd", "4th" … for the temporary score label (H1). */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
