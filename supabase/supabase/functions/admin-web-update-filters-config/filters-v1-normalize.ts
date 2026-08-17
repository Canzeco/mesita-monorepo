// Filters config v1 normalizer — the EF-side mirror of the admin catalog
// (apps/web-admin/src/app/(app)/filters-config/filters.ts). Keep them in
// lock-step: same keys, same clamps, same defaults.
//
// Accepts anything and returns a COMPLETE v1 config. A partial body, a stale
// client's shape, or outright garbage all resolve to something the console can
// render — the writer is the last line before the singleton, so it never
// stores a half-blob.

export type ModuleKey =
  | "context"
  | "where"
  | "distance"
  | "when"
  | "what"
  | "random";

export const MODULE_KEYS: ModuleKey[] = [
  "context",
  "where",
  "distance",
  "when",
  "what",
  "random",
];

export type SurfaceKey =
  | "swipe"
  | "catalog"
  | "chat"
  | "social"
  | "map"
  | "search";

export const SURFACE_KEYS: SurfaceKey[] = [
  "swipe",
  "catalog",
  "chat",
  "social",
  "map",
  "search",
];

export type ContextDefault = "any" | "visit";
export type WhenDefault = "now" | "anytime";
export type ModuleToggle = "inherit" | "on" | "off";

const CONTEXT_DEFAULTS: ContextDefault[] = ["any", "visit"];
const WHEN_DEFAULTS: WhenDefault[] = ["now", "anytime"];
const MODULE_TOGGLES: ModuleToggle[] = ["inherit", "on", "off"];

export const DISTANCE_FLOOR_KM = 1;
export const DISTANCE_CEILING_KM = 200;
export const RANDOMNESS_CEILING = 4;
export const CATEGORY_CAP_CEILING = 40;
export const RESULT_CAP_CEILING = 500;

export type GeneralFilters = {
  modules: Record<ModuleKey, boolean>;
  defaults: {
    context: ContextDefault;
    when: WhenDefault;
    maxKm: number | null;
    randomness: number;
  };
  bounds: {
    distanceMinKm: number;
    distanceMaxKm: number;
    randomnessMax: number;
    categoryOptionsCap: number;
  };
  behavior: {
    sharedStore: boolean;
    persistSession: boolean;
    zoneSeedsRadius: boolean;
  };
};

export type SurfaceFilters = {
  enabled: boolean;
  modules: Record<ModuleKey, ModuleToggle>;
  overrides: {
    context: ContextDefault | null;
    when: WhenDefault | null;
    maxKm: number | "any" | null;
    randomness: number | null;
  };
  resultCap: number | null;
};

export type FiltersConfigV1 = {
  version: 1;
  general: GeneralFilters;
  surfaces: Record<SurfaceKey, SurfaceFilters>;
};

function everyModule<T>(value: T): Record<ModuleKey, T> {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, value])) as Record<
    ModuleKey,
    T
  >;
}

function defaultSurface(enabled: boolean): SurfaceFilters {
  return {
    enabled,
    modules: everyModule<ModuleToggle>("inherit"),
    overrides: { context: null, when: null, maxKm: null, randomness: null },
    resultCap: null,
  };
}

/** Mirrors DEFAULT_FILTERS in the admin catalog — the shipped engine's values. */
export const DEFAULT_FILTERS_V1: FiltersConfigV1 = {
  version: 1,
  general: {
    modules: everyModule(true),
    defaults: {
      context: "any",
      when: "anytime",
      maxKm: null,
      randomness: 0,
    },
    bounds: {
      distanceMinKm: 1,
      distanceMaxKm: 50,
      randomnessMax: 4,
      categoryOptionsCap: 12,
    },
    behavior: {
      sharedStore: true,
      persistSession: true,
      zoneSeedsRadius: true,
    },
  },
  surfaces: {
    swipe: defaultSurface(true),
    catalog: defaultSurface(false),
    chat: defaultSurface(false),
    social: defaultSurface(false),
    map: defaultSurface(true),
    search: defaultSurface(true),
  },
};

function isBlob(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function oneOf<T extends string>(
  v: unknown,
  allowed: T[],
  fallback: T,
): T {
  return typeof v === "string" && (allowed as string[]).includes(v)
    ? (v as T)
    : fallback;
}

function nullableKm(v: unknown, fallback: number | null): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
  return Math.max(
    DISTANCE_FLOOR_KM,
    Math.min(DISTANCE_CEILING_KM, Math.round(v)),
  );
}

function normalizeGeneral(raw: unknown): GeneralFilters {
  const d = DEFAULT_FILTERS_V1.general;
  if (!isBlob(raw)) return structuredClone(d);

  const modulesRaw = isBlob(raw.modules) ? raw.modules : {};
  const defaultsRaw = isBlob(raw.defaults) ? raw.defaults : {};
  const boundsRaw = isBlob(raw.bounds) ? raw.bounds : {};
  const behaviorRaw = isBlob(raw.behavior) ? raw.behavior : {};

  return {
    modules: Object.fromEntries(
      MODULE_KEYS.map((k) => [k, bool(modulesRaw[k], d.modules[k])]),
    ) as Record<ModuleKey, boolean>,
    defaults: {
      context: oneOf(defaultsRaw.context, CONTEXT_DEFAULTS, d.defaults.context),
      when: oneOf(defaultsRaw.when, WHEN_DEFAULTS, d.defaults.when),
      maxKm: nullableKm(defaultsRaw.maxKm, d.defaults.maxKm),
      randomness: int(
        defaultsRaw.randomness,
        d.defaults.randomness,
        0,
        RANDOMNESS_CEILING,
      ),
    },
    bounds: {
      distanceMinKm: int(
        boundsRaw.distanceMinKm,
        d.bounds.distanceMinKm,
        DISTANCE_FLOOR_KM,
        DISTANCE_CEILING_KM,
      ),
      distanceMaxKm: int(
        boundsRaw.distanceMaxKm,
        d.bounds.distanceMaxKm,
        DISTANCE_FLOOR_KM,
        DISTANCE_CEILING_KM,
      ),
      randomnessMax: int(
        boundsRaw.randomnessMax,
        d.bounds.randomnessMax,
        0,
        RANDOMNESS_CEILING,
      ),
      categoryOptionsCap: int(
        boundsRaw.categoryOptionsCap,
        d.bounds.categoryOptionsCap,
        1,
        CATEGORY_CAP_CEILING,
      ),
    },
    behavior: {
      sharedStore: bool(behaviorRaw.sharedStore, d.behavior.sharedStore),
      persistSession: bool(
        behaviorRaw.persistSession,
        d.behavior.persistSession,
      ),
      zoneSeedsRadius: bool(
        behaviorRaw.zoneSeedsRadius,
        d.behavior.zoneSeedsRadius,
      ),
    },
  };
}

function normalizeSurface(
  raw: unknown,
  fallback: SurfaceFilters,
): SurfaceFilters {
  if (!isBlob(raw)) return structuredClone(fallback);

  const modulesRaw = isBlob(raw.modules) ? raw.modules : {};
  const overridesRaw = isBlob(raw.overrides) ? raw.overrides : {};

  const rawMaxKm = overridesRaw.maxKm;
  const maxKm: number | "any" | null = rawMaxKm === "any"
    ? "any"
    : typeof rawMaxKm === "number" && Number.isFinite(rawMaxKm) && rawMaxKm > 0
    ? Math.max(
      DISTANCE_FLOOR_KM,
      Math.min(DISTANCE_CEILING_KM, Math.round(rawMaxKm)),
    )
    : null;

  return {
    enabled: bool(raw.enabled, fallback.enabled),
    modules: Object.fromEntries(
      MODULE_KEYS.map((k) => [
        k,
        oneOf(modulesRaw[k], MODULE_TOGGLES, fallback.modules[k]),
      ]),
    ) as Record<ModuleKey, ModuleToggle>,
    overrides: {
      context: overridesRaw.context == null
        ? null
        : oneOf(overridesRaw.context, CONTEXT_DEFAULTS, "any"),
      when: overridesRaw.when == null
        ? null
        : oneOf(overridesRaw.when, WHEN_DEFAULTS, "anytime"),
      maxKm,
      randomness:
        typeof overridesRaw.randomness === "number" &&
          Number.isFinite(overridesRaw.randomness)
          ? int(overridesRaw.randomness, 0, 0, RANDOMNESS_CEILING)
          : null,
    },
    resultCap: typeof raw.resultCap === "number" &&
        Number.isFinite(raw.resultCap) && raw.resultCap > 0
      ? int(raw.resultCap, RESULT_CAP_CEILING, 1, RESULT_CAP_CEILING)
      : null,
  };
}

export function normalizeFiltersV1(raw: unknown): FiltersConfigV1 {
  if (!isBlob(raw)) return structuredClone(DEFAULT_FILTERS_V1);
  const surfacesRaw = isBlob(raw.surfaces) ? raw.surfaces : {};
  return {
    version: 1,
    general: normalizeGeneral(raw.general),
    surfaces: Object.fromEntries(
      SURFACE_KEYS.map((k) => [
        k,
        normalizeSurface(surfacesRaw[k], DEFAULT_FILTERS_V1.surfaces[k]),
      ]),
    ) as Record<SurfaceKey, SurfaceFilters>,
  };
}
