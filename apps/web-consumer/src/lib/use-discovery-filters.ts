"use client";

// ONE shared discovery-filter store for every consumer surface (MESITA-646,
// v3 schema MESITA-672). Module-level state + useSyncExternalStore (the
// saved-places pattern): the Swipe deck and its trigger dot read these
// filters. Search map Places scope + Super Category live in use-map-filters.
// Persisted to sessionStorage like the swipe snapshot. The server snapshot is
// always the defaults, so SSR HTML stays deterministic; React swaps in the
// persisted client snapshot right after hydration.

import { useSyncExternalStore } from "react";
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
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v5: the v3 shape minus randomness (MESITA-1236 — a named discovery signal,
// so it does not live here). `ask` (the That axis, MESITA-699) was dropped — Memo
// owns it and carries it on its own call. The key stays v4 because ignoring a
// removed field is backward-safe; bumping would wipe live zone/when/distance.
// `context` (MESITA-1081) rides the same key for the same reason: a session
// written before it existed just reads the `any` default.
// Old keys are ignored, including the retired `randomness` level: a session
// stored before MESITA-1236 simply drops it on read.
const STORAGE_KEY = "mesita_discovery_filters_v4";

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));
const ZONE_LEVELS = new Set<string>(DISCOVERY_ZONE_LEVELS);
const CONTEXTS = new Set<string>(DISCOVERY_CONTEXTS);

function readContext(raw: unknown): DiscoveryContext {
  if (typeof raw !== "string" || !CONTEXTS.has(raw)) return "any";
  const context = raw as DiscoveryContext;
  // A parked context coerces back to `any`: the pill is disabled, so a session
  // carrying it would be narrowing by something the guest can't see or clear.
  return discoveryContextIsSoon(context) ? "any" : context;
}

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

function readPersisted(): DiscoveryFilters {
  if (typeof window === "undefined") return DISCOVERY_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DISCOVERY_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof DiscoveryFilters, unknown>
    >;
    const maxKm =
      typeof parsed.maxKm === "number" &&
      Number.isFinite(parsed.maxKm) &&
      parsed.maxKm > 0
        ? parsed.maxKm
        : null;
    return {
      context: readContext(parsed.context),
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
    };
  } catch {
    return DISCOVERY_FILTER_DEFAULTS;
  }
}

let state: DiscoveryFilters = readPersisted();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
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

/**
 * Set the Where center (null = current location). Picking a searched zone seeds
 * a level-appropriate radius when none is set, so "Manhattan" narrows right
 * away instead of showing the whole catalog re-centered.
 */
export function setDiscoveryZone(zone: DiscoveryZone | null) {
  if (!zone) {
    // Back to current location — the distance ring was tied to the searched
    // center, so start fresh (Any distance) rather than measuring a stale
    // radius against a center the user can no longer see.
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

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
