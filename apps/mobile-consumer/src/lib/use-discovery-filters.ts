// ONE shared discovery-filter store for every consumer surface (MESITA-646,
// v3 schema MESITA-672). Module-level state + useSyncExternalStore — port of
// web use-discovery-filters.ts. Persists via AsyncStorage (web uses
// sessionStorage). Swipe + Search + both trigger dots read the SAME filters.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import {
  DISCOVERY_CONTEXTS,
  DISCOVERY_FILTER_DEFAULTS,
  DISCOVERY_ZONE_LEVELS,
  defaultRadiusForLevel,
  discoveryContextIsSoon,
  type DiscoveryContext,
  type DiscoveryFilters,
  type DiscoveryWhen,
  type DiscoveryZone,
  type DiscoveryZoneLevel,
  type RandomnessLevel,
} from '@/lib/discovery-filters-engine';
import { PLACE_FAMILIES, type FamilyKey } from '@/lib/place-families';

// v4 = v3 + `ask` (the intent's That axis, MESITA-699), since dropped — Memo
// owns the ask and carries it on its own call. The key stays v4 because
// ignoring a removed field is backward-safe; bumping would wipe live
// zone/when/distance. `context` (MESITA-1081) rides the same key for the same
// reason: a session written before it existed just reads the `any` default.
// Old keys ignored.
const STORAGE_KEY = 'mesita_discovery_filters_v4';

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));
const ZONE_LEVELS = new Set<string>(DISCOVERY_ZONE_LEVELS);
const CONTEXTS = new Set<string>(DISCOVERY_CONTEXTS);

function readContext(raw: unknown): DiscoveryContext {
  if (typeof raw !== 'string' || !CONTEXTS.has(raw)) return 'any';
  const context = raw as DiscoveryContext;
  // A parked context coerces back to `any`: the pill is disabled, so a session
  // carrying it would be narrowing by something the guest can't see or clear.
  return discoveryContextIsSoon(context) ? 'any' : context;
}

function readZone(raw: unknown): DiscoveryZone | null {
  if (!raw || typeof raw !== 'object') return null;
  const z = raw as Record<string, unknown>;
  if (typeof z.lat !== 'number' || typeof z.lng !== 'number') return null;
  if (typeof z.label !== 'string' || !z.label.trim()) return null;
  const level =
    typeof z.level === 'string' && ZONE_LEVELS.has(z.level)
      ? (z.level as DiscoveryZoneLevel)
      : undefined;
  return { label: z.label, lat: z.lat, lng: z.lng, level };
}

function readWhen(raw: unknown): DiscoveryWhen {
  if (raw && typeof raw === 'object') {
    const w = raw as Record<string, unknown>;
    if (w.mode === 'now') return { mode: 'now' };
    if (
      w.mode === 'at' &&
      typeof w.day === 'number' &&
      typeof w.hour === 'number'
    ) {
      const day = ((Math.round(w.day) % 7) + 7) % 7;
      const hour = Math.min(23, Math.max(0, Math.round(w.hour)));
      return { mode: 'at', day, hour };
    }
  }
  return { mode: 'anytime' };
}

function parsePersisted(raw: string): DiscoveryFilters {
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof DiscoveryFilters, unknown>
    >;
    const maxKm =
      typeof parsed.maxKm === 'number' &&
      Number.isFinite(parsed.maxKm) &&
      parsed.maxKm > 0
        ? parsed.maxKm
        : null;
    // Legacy sessions stored 0..5; clamp 5 → 4 (new max word level).
    const randomness =
      typeof parsed.randomness === 'number' &&
      Number.isInteger(parsed.randomness) &&
      parsed.randomness >= 0
        ? ((parsed.randomness > 4 ? 4 : parsed.randomness) as RandomnessLevel)
        : 0;
    return {
      context: readContext(parsed.context),
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === 'string' && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      categories: Array.isArray(parsed.categories)
        ? (parsed.categories as unknown[]).filter(
            (c): c is string => typeof c === 'string' && c.trim().length > 0,
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
      if (raw) state = parsePersisted(raw);
    } catch {
      /* degrade silently */
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

function subscribe(listener: () => void): () => void {
  void hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function patchDiscoveryFilters(partial: Partial<DiscoveryFilters>) {
  state = { ...state, ...partial };
  persist();
  emit();
}

export function resetDiscoveryFilters() {
  state = DISCOVERY_FILTER_DEFAULTS;
  persist();
  emit();
}

/**
 * Set the prioritized context. Parked contexts (`order`) are refused rather
 * than stored — the sheet disables that pill, so accepting it would leave a
 * filter the guest can neither see nor clear.
 */
export function setDiscoveryContext(context: DiscoveryContext) {
  if (discoveryContextIsSoon(context)) return;
  patchDiscoveryFilters({ context });
}

export function toggleDiscoveryFamily(key: FamilyKey) {
  patchDiscoveryFilters({
    familyKeys: state.familyKeys.includes(key)
      ? state.familyKeys.filter((k) => k !== key)
      : [...state.familyKeys, key],
  });
}

export function toggleDiscoveryCategory(slug: string) {
  patchDiscoveryFilters({
    categories: state.categories.includes(slug)
      ? state.categories.filter((c) => c !== slug)
      : [...state.categories, slug],
  });
}

export function setDiscoveryZone(zone: DiscoveryZone | null) {
  if (!zone) {
    patchDiscoveryFilters({ zone: null, maxKm: null });
    return;
  }
  const maxKm =
    state.maxKm === null ? defaultRadiusForLevel(zone.level) : state.maxKm;
  patchDiscoveryFilters({ zone, maxKm });
}

export function setDiscoveryWhen(when: DiscoveryWhen) {
  patchDiscoveryFilters({ when });
}

export function setDiscoveryMaxKm(maxKm: number | null) {
  patchDiscoveryFilters({ maxKm });
}

export function setDiscoveryRandomness(randomness: RandomnessLevel) {
  patchDiscoveryFilters({ randomness });
}

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
