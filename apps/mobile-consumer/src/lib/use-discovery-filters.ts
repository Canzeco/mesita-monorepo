// ONE shared discovery-filter store for every consumer surface (MESITA-646,
// v3 schema MESITA-672). RN port of apps/web-consumer/src/lib/use-discovery-
// filters.ts — PROVIDER-LESS: module-level state + useSyncExternalStore (the
// saved-places pattern), so the Swipe deck, the Search map and both trigger
// dots read the SAME filters with no provider mount. Persisted to AsyncStorage
// (the web store used sessionStorage); hydration is async, so the store starts
// on the defaults and swaps in the persisted snapshot once it resolves — every
// mutation waits on `hydrate()` first, exactly like saved-places, so nothing is
// clobbered by a late read.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  defaultRadiusForLevel,
  type DiscoveryFilters,
  type DiscoveryWhen,
  type DiscoveryZone,
  type DiscoveryZoneLevel,
  type RandomnessLevel,
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v3: the MESITA-672 shape (searched zone center + km radius, when union, 0–5
// randomness). Old v1/v2 keys are simply ignored — session-scoped state needs
// no migration.
const STORAGE_KEY = "mesita:discovery-filters-v3";

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));
const ZONE_LEVELS = new Set<string>([
  "address",
  "street",
  "neighborhood",
  "city",
  "county",
  "state",
  "country",
]);

function readZone(raw: unknown): DiscoveryZone | null {
  if (!raw || typeof raw !== "object") return null;
  const z = raw as Record<string, unknown>;
  if (typeof z.lat !== "number" || typeof z.lng !== "number") return null;
  if (typeof z.label !== "string" || !z.label.trim()) return null;
  const level =
    typeof z.level === "string" && ZONE_LEVELS.has(z.level)
      ? (z.level as DiscoveryZoneLevel)
      : undefined;
  return { label: z.label, lat: z.lat, lng: z.lng, level };
}

function readWhen(raw: unknown): DiscoveryWhen {
  if (raw && typeof raw === "object") {
    const w = raw as Record<string, unknown>;
    if (w.mode === "now") return { mode: "now" };
    if (
      w.mode === "at" &&
      typeof w.day === "number" &&
      typeof w.hour === "number"
    ) {
      const day = ((Math.round(w.day) % 7) + 7) % 7;
      const hour = Math.min(23, Math.max(0, Math.round(w.hour)));
      return { mode: "at", day, hour };
    }
  }
  return { mode: "anytime" };
}

function parsePersisted(raw: string | null): DiscoveryFilters {
  if (!raw) return DISCOVERY_FILTER_DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof DiscoveryFilters, unknown>
    >;
    const maxKm =
      typeof parsed.maxKm === "number" &&
      Number.isFinite(parsed.maxKm) &&
      parsed.maxKm > 0
        ? parsed.maxKm
        : null;
    const randomness = ([0, 1, 2, 3, 4, 5] as const).includes(
      parsed.randomness as RandomnessLevel,
    )
      ? (parsed.randomness as RandomnessLevel)
      : 0;
    return {
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      categories: Array.isArray(parsed.categories)
        ? (parsed.categories as unknown[]).filter(
            (c): c is string => typeof c === "string" && c.trim().length > 0,
          )
        : [],
      zone: readZone(parsed.zone),
      maxKm,
      when: readWhen(parsed.when),
      randomness,
    };
  } catch {
    return DISCOVERY_FILTER_DEFAULTS;
  }
}

// The server snapshot is the defaults so the first paint is deterministic;
// AsyncStorage hydration swaps in the persisted snapshot right after.
let state: DiscoveryFilters = DISCOVERY_FILTER_DEFAULTS;
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      state = parsePersisted(raw);
    } catch {
      // degrade silently — keep the defaults
    } finally {
      hydrated = true;
      hydrating = null;
      emit();
    }
  })();
  return hydrating;
}

function persist() {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(
    () => undefined,
  );
}

function apply(partial: Partial<DiscoveryFilters>) {
  state = { ...state, ...partial };
  persist();
  emit();
}

function subscribe(listener: () => void): () => void {
  // Kick hydration on first subscribe so AsyncStorage loads before paints settle.
  void hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DiscoveryFilters {
  return state;
}

// Every mutator waits on hydrate() first (saved-places pattern): a change made
// before AsyncStorage resolves still reads/patches the persisted state, never
// the stale defaults.
export function patchDiscoveryFilters(partial: Partial<DiscoveryFilters>) {
  void hydrate().then(() => apply(partial));
}

export function resetDiscoveryFilters() {
  void hydrate().then(() => apply(DISCOVERY_FILTER_DEFAULTS));
}

export function toggleDiscoveryFamily(key: FamilyKey) {
  void hydrate().then(() =>
    apply({
      familyKeys: state.familyKeys.includes(key)
        ? state.familyKeys.filter((k) => k !== key)
        : [...state.familyKeys, key],
    }),
  );
}

export function toggleDiscoveryCategory(slug: string) {
  void hydrate().then(() =>
    apply({
      categories: state.categories.includes(slug)
        ? state.categories.filter((c) => c !== slug)
        : [...state.categories, slug],
    }),
  );
}

/**
 * Set the Where center (null = current location). Picking a searched zone seeds
 * a level-appropriate radius when none is set, so "Manhattan" narrows right
 * away instead of showing the whole catalog re-centered.
 */
export function setDiscoveryZone(zone: DiscoveryZone | null) {
  void hydrate().then(() => {
    if (!zone) {
      // Back to current location — the distance ring was tied to the searched
      // center, so start fresh (Any distance) rather than measuring a stale
      // radius against a center the user can no longer see.
      apply({ zone: null, maxKm: null });
      return;
    }
    const maxKm =
      state.maxKm === null ? defaultRadiusForLevel(zone.level) : state.maxKm;
    apply({ zone, maxKm });
  });
}

export function setDiscoveryWhen(when: DiscoveryWhen) {
  void hydrate().then(() => apply({ when }));
}

export function setDiscoveryMaxKm(maxKm: number | null) {
  void hydrate().then(() => apply({ maxKm }));
}

export function setDiscoveryRandomness(randomness: RandomnessLevel) {
  void hydrate().then(() => apply({ randomness }));
}

export function useDiscoveryFilters(): DiscoveryFilters {
  // Kick hydration on first hook mount so AsyncStorage loads before paints settle.
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
