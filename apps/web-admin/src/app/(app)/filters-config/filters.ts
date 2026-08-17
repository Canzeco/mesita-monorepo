// Filters Config catalog — the v1 model (MESITA-1083).
//
// ONE blob governs every consumer filter surface, in two tiers:
//
//   GENERAL  — the law. Which of the six modules exist at all, what the sheet
//              opens on, the bounds a surface may not exceed, how the store
//              behaves.
//   SURFACES — one screen each (Swipe · Catalog · Chat · Social · Map ·
//              Search). A surface either inherits the law or overrides it.
//              `inherit` is a real third state, not a synonym for `on`: it
//              tracks General when General changes.
//
// The defaults below are not invented — they are the values the shipped
// consumer engine already runs (discovery-filters-engine.ts, both apps), so
// the first load of this page describes the product as it actually is.
//
// STAGED END TO END. Nothing reads this blob yet; the consumer sheet still
// holds its own code defaults. Every card says so via KnobStatus "not-wired"
// — a knob here is a declaration of intent, not behaviour, until the consumer
// wiring lands. That labelling is the house rule for staged config, not a
// nicety (Ojo Config carries the same contract).
//
// Pure module on purpose — vitest can't import server-action chains (the
// promo-state.ts precedent), and the EF normalizer mirrors this file
// (admin-web-update-filters-config/filters-v1-normalize.ts) — keep them in
// lock-step.

// ── Modules ─────────────────────────────────────────────────────────────────
/** The six controls the consumer Filters sheet can expose, in sheet order. */
export type ModuleKey =
  | "context"
  | "where"
  | "distance"
  | "when"
  | "what"
  | "random";

export const MODULE_KEYS = [
  "context",
  "where",
  "distance",
  "when",
  "what",
  "random",
] as const satisfies ReadonlyArray<ModuleKey>;

export const MODULE_META: Record<
  ModuleKey,
  { label: string; blurb: string }
> = {
  context: {
    label: "Context",
    blurb:
      "Any · Visit · Order. The cut that runs before everything else, mirroring Promos v11. Order is parked.",
  },
  where: {
    label: "Where",
    blurb:
      "Free location search at any level, or current location. Recenters distances; excludes nothing on its own.",
  },
  distance: {
    label: "Distance",
    blurb: "Radius in km around the Where center. The actual narrowing knob.",
  },
  when: {
    label: "When",
    blurb:
      "Now · Anytime · a weekday + hour, resolved place-local. No hours table means the place can't be confirmed open.",
  },
  what: {
    label: "What",
    blurb:
      "Place families ORed with catalog-derived concrete categories. Options come from the host's catalog, so no pick is a dead end.",
  },
  random: {
    label: "Random",
    blurb:
      "Deck ordering, low → max. Not a predicate — it reorders, it never excludes.",
  },
};

// ── Surfaces ────────────────────────────────────────────────────────────────
export type SurfaceKey =
  | "swipe"
  | "catalog"
  | "chat"
  | "social"
  | "map"
  | "search";

export const SURFACE_KEYS = [
  "swipe",
  "catalog",
  "chat",
  "social",
  "map",
  "search",
] as const satisfies ReadonlyArray<SurfaceKey>;

export const SURFACE_META: Record<
  SurfaceKey,
  {
    label: string;
    blurb: string;
    /** False when the consumer surface itself is parked — knobs are doubly staged. */
    live: boolean;
    /** Why it's parked. Empty for live surfaces. */
    parkedNote: string;
  }
> = {
  swipe: {
    label: "Swipe",
    blurb:
      "Home › Swipe — the card deck. The only surface that applies Random, since ordering is all a deck is.",
    live: true,
    parkedNote: "",
  },
  catalog: {
    label: "Catalog",
    blurb: "Home › Catalog — the grid of every place.",
    live: false,
    parkedNote:
      "The Catalog mode is parked in the consumer app: the pill opens a coming-soon dialog and the route redirects to Swipe. CatalogGrid works — un-parking is a flag plus the page body.",
  },
  chat: {
    label: "Chat",
    blurb:
      "Home › Chat — Don Memo. The only surface with an agent behind it, so Memo's own config lives here too rather than as a sibling of the surface it powers.",
    live: false,
    parkedNote:
      "The Chat mode is parked in the consumer app: /home/chat redirects to Swipe and the pill opens a coming-soon dialog.",
  },
  social: {
    label: "Social",
    blurb: "Home › Social — global activity.",
    live: false,
    parkedNote:
      "The Social mode is parked in the consumer app: the pill opens a coming-soon dialog and the route redirects to Swipe.",
  },
  map: {
    label: "Map",
    blurb:
      "Search › the map layer — the pin set. Random is deliberately inert here: shuffling pins on a map means nothing.",
    live: true,
    parkedNote: "",
  },
  search: {
    label: "Search",
    blurb:
      "Search › the searchbar and result list — free-text matching over name, zone and category, on top of the sheet.",
    live: true,
    parkedNote: "",
  },
};

// ── Value types ─────────────────────────────────────────────────────────────
/** What the sheet opens on for the Context axis. `order` is never a default — it's parked. */
export type ContextDefault = "any" | "visit";
export const CONTEXT_DEFAULTS = ["any", "visit"] as const;

export type WhenDefault = "now" | "anytime";
export const WHEN_DEFAULTS = ["now", "anytime"] as const;

/**
 * Per-surface module state. `inherit` TRACKS General — it is not a copy taken
 * at save time, so flipping a module off in General silently takes it off every
 * inheriting surface, which is the whole point of the tier.
 */
export type ModuleToggle = "inherit" | "on" | "off";
export const MODULE_TOGGLES = ["inherit", "on", "off"] as const;

export type GeneralFilters = {
  /** Master switch per module. Off here is off everywhere, override or not. */
  modules: Record<ModuleKey, boolean>;
  defaults: {
    context: ContextDefault;
    when: WhenDefault;
    /** Radius the sheet opens on; null = Any distance. */
    maxKm: number | null;
    randomness: number;
  };
  bounds: {
    distanceMinKm: number;
    distanceMaxKm: number;
    /** Top of the Random slider — the shipped engine's ceiling is 4. */
    randomnessMax: number;
    /** How many concrete categories the What module derives from the catalog. */
    categoryOptionsCap: number;
  };
  behavior: {
    /** ONE store across every surface: narrowing on Swipe narrows Search too. */
    sharedStore: boolean;
    /** Survive a reload within the session (sessionStorage / AsyncStorage). */
    persistSession: boolean;
    /** Picking a zone auto-applies a radius sized to the pick's level. */
    zoneSeedsRadius: boolean;
  };
};

export type SurfaceFilters = {
  /** Whether the Filters entry point exists on this surface at all. */
  enabled: boolean;
  modules: Record<ModuleKey, ModuleToggle>;
  /** null = inherit the General default. */
  overrides: {
    context: ContextDefault | null;
    when: WhenDefault | null;
    /** A number is km, "any" is an explicit no-radius, null inherits. */
    maxKm: number | "any" | null;
    randomness: number | null;
  };
  /** Hard ceiling on places this surface renders after filtering; null = none. */
  resultCap: number | null;
};

export type FiltersConfig = {
  version: 1;
  general: GeneralFilters;
  surfaces: Record<SurfaceKey, SurfaceFilters>;
};

// ── Defaults ────────────────────────────────────────────────────────────────
// These mirror the SHIPPED consumer engine. Changing one here is a proposal;
// changing the engine is the change.
export const DISTANCE_FLOOR_KM = 1;
export const DISTANCE_CEILING_KM = 200;
export const RANDOMNESS_CEILING = 4;
export const CATEGORY_CAP_CEILING = 40;
export const RESULT_CAP_CEILING = 500;

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

export const DEFAULT_FILTERS: FiltersConfig = {
  version: 1,
  general: {
    modules: everyModule(true),
    defaults: {
      // Anytime + Any = the neutral open the sheet actually ships with: a
      // fresh sheet never hides the catalog behind a filter nobody chose.
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
    // Live surfaces default on; the three parked Home modes default off, so
    // the blob describes the product rather than a wish.
    swipe: defaultSurface(true),
    catalog: defaultSurface(false),
    chat: defaultSurface(false),
    social: defaultSurface(false),
    map: defaultSurface(true),
    search: defaultSurface(true),
  },
};

// ── Resolution ──────────────────────────────────────────────────────────────
export type ResolvedSurface = {
  enabled: boolean;
  modules: Record<ModuleKey, boolean>;
  defaults: {
    context: ContextDefault;
    when: WhenDefault;
    maxKm: number | null;
    randomness: number;
  };
};

/**
 * What a surface ACTUALLY ends up with once General and the overrides are
 * folded together — the view the operator needs to answer "so what does Swipe
 * do?". General's master switch wins: a module off in General is off here even
 * if the surface says `on`, because a control the product doesn't have can't be
 * turned back on one screen at a time.
 */
export function resolveSurface(
  cfg: FiltersConfig,
  key: SurfaceKey,
): ResolvedSurface {
  const surface = cfg.surfaces[key];
  const { modules: master, defaults } = cfg.general;

  const modules = Object.fromEntries(
    MODULE_KEYS.map((k) => {
      const toggle = surface.modules[k];
      const on = toggle === "inherit" ? true : toggle === "on";
      return [k, master[k] && on];
    }),
  ) as Record<ModuleKey, boolean>;

  const maxKm =
    surface.overrides.maxKm === null
      ? defaults.maxKm
      : surface.overrides.maxKm === "any"
        ? null
        : surface.overrides.maxKm;

  return {
    enabled: surface.enabled,
    modules,
    defaults: {
      context: surface.overrides.context ?? defaults.context,
      when: surface.overrides.when ?? defaults.when,
      maxKm,
      randomness: surface.overrides.randomness ?? defaults.randomness,
    },
  };
}

/**
 * Contradictions worth REPORTING, never auto-correcting (the Promos precedent —
 * the page shows the violation and lets the operator decide).
 */
export function surfaceWarnings(
  cfg: FiltersConfig,
  key: SurfaceKey,
): string[] {
  const surface = cfg.surfaces[key];
  const resolved = resolveSurface(cfg, key);
  const out: string[] = [];

  for (const k of MODULE_KEYS) {
    if (surface.modules[k] === "on" && !cfg.general.modules[k]) {
      out.push(
        `${MODULE_META[k].label} is on here but off in General — General wins, so it stays hidden.`,
      );
    }
  }

  if (!resolved.modules.distance && surface.overrides.maxKm !== null) {
    out.push(
      "A distance override is set, but the Distance module is off on this surface.",
    );
  }
  if (!resolved.modules.random && surface.overrides.randomness !== null) {
    out.push(
      "A Random override is set, but the Random module is off on this surface.",
    );
  }
  if (!resolved.modules.context && surface.overrides.context !== null) {
    out.push(
      "A Context override is set, but the Context module is off on this surface.",
    );
  }
  if (!resolved.modules.when && surface.overrides.when !== null) {
    out.push(
      "A When override is set, but the When module is off on this surface.",
    );
  }
  if (!surface.enabled && MODULE_KEYS.some((k) => resolved.modules[k])) {
    out.push(
      "Filters are disabled on this surface, so none of the modules above are reachable.",
    );
  }
  if (
    typeof resolved.defaults.maxKm === "number" &&
    resolved.defaults.maxKm > cfg.general.bounds.distanceMaxKm
  ) {
    out.push(
      `The resolved default radius (${resolved.defaults.maxKm} km) is past the slider's ceiling (${cfg.general.bounds.distanceMaxKm} km).`,
    );
  }
  if (resolved.defaults.randomness > cfg.general.bounds.randomnessMax) {
    out.push(
      `The resolved default Random level (${resolved.defaults.randomness}) is past the ceiling (${cfg.general.bounds.randomnessMax}).`,
    );
  }

  return out;
}

/** Contradictions inside General itself. */
export function generalWarnings(cfg: FiltersConfig): string[] {
  const { modules, defaults, bounds } = cfg.general;
  const out: string[] = [];

  if (bounds.distanceMinKm >= bounds.distanceMaxKm) {
    out.push(
      "The distance floor is not below the ceiling — the slider would have no range.",
    );
  }
  if (
    typeof defaults.maxKm === "number" &&
    (defaults.maxKm < bounds.distanceMinKm || defaults.maxKm > bounds.distanceMaxKm)
  ) {
    out.push(
      `The default radius (${defaults.maxKm} km) sits outside the slider's ${bounds.distanceMinKm}–${bounds.distanceMaxKm} km range.`,
    );
  }
  if (defaults.randomness > bounds.randomnessMax) {
    out.push(
      `The default Random level (${defaults.randomness}) is past the ceiling (${bounds.randomnessMax}).`,
    );
  }
  if (!modules.where && modules.distance) {
    out.push(
      "Distance is on but Where is off — there would be no center to measure a radius from.",
    );
  }
  if (!modules.distance && typeof defaults.maxKm === "number") {
    out.push(
      "A default radius is set but the Distance module is off, so nothing would apply it.",
    );
  }
  if (defaults.context === "visit" && !modules.context) {
    out.push(
      "The default context is Visit but the Context module is off — the sheet would narrow to reward-running places with no visible control to clear it.",
    );
  }
  if (defaults.when === "now" && !modules.when) {
    out.push(
      "The default is Now but the When module is off — places without an hours table would vanish with no visible control to clear it.",
    );
  }

  return out;
}

// ── Coercion ────────────────────────────────────────────────────────────────
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
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  return typeof v === "string" && (allowed as ReadonlyArray<string>).includes(v)
    ? (v as T)
    : fallback;
}

/** Nullable positive km. `null` survives as null — it means "Any". */
function nullableKm(v: unknown, fallback: number | null): number | null {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return fallback;
  return Math.max(
    DISTANCE_FLOOR_KM,
    Math.min(DISTANCE_CEILING_KM, Math.round(v)),
  );
}

function coerceGeneral(raw: unknown): GeneralFilters {
  const d = DEFAULT_FILTERS.general;
  if (!isBlob(raw)) return structuredClone(d);

  const modulesRaw = isBlob(raw.modules) ? raw.modules : {};
  const defaultsRaw = isBlob(raw.defaults) ? raw.defaults : {};
  const boundsRaw = isBlob(raw.bounds) ? raw.bounds : {};
  const behaviorRaw = isBlob(raw.behavior) ? raw.behavior : {};

  const bounds = {
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
  };

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
    bounds,
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

function coerceSurface(raw: unknown, fallback: SurfaceFilters): SurfaceFilters {
  if (!isBlob(raw)) return structuredClone(fallback);

  const modulesRaw = isBlob(raw.modules) ? raw.modules : {};
  const overridesRaw = isBlob(raw.overrides) ? raw.overrides : {};

  const rawMaxKm = overridesRaw.maxKm;
  const maxKm: number | "any" | null =
    rawMaxKm === "any"
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
      context:
        overridesRaw.context == null
          ? null
          : oneOf(overridesRaw.context, CONTEXT_DEFAULTS, "any"),
      when:
        overridesRaw.when == null
          ? null
          : oneOf(overridesRaw.when, WHEN_DEFAULTS, "anytime"),
      maxKm,
      randomness:
        typeof overridesRaw.randomness === "number" &&
        Number.isFinite(overridesRaw.randomness)
          ? int(overridesRaw.randomness, 0, 0, RANDOMNESS_CEILING)
          : null,
    },
    resultCap:
      typeof raw.resultCap === "number" &&
      Number.isFinite(raw.resultCap) &&
      raw.resultCap > 0
        ? int(raw.resultCap, RESULT_CAP_CEILING, 1, RESULT_CAP_CEILING)
        : null,
  };
}

/** Accepts anything, returns a COMPLETE v1 config — never a partial. */
export function coerceFiltersConfig(raw: unknown): FiltersConfig {
  if (!isBlob(raw)) return structuredClone(DEFAULT_FILTERS);
  const surfacesRaw = isBlob(raw.surfaces) ? raw.surfaces : {};
  return {
    version: 1,
    general: coerceGeneral(raw.general),
    surfaces: Object.fromEntries(
      SURFACE_KEYS.map((k) => [
        k,
        coerceSurface(surfacesRaw[k], DEFAULT_FILTERS.surfaces[k]),
      ]),
    ) as Record<SurfaceKey, SurfaceFilters>,
  };
}
