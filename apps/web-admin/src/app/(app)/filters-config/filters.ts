// Filters Config catalog — the v1 model (MESITA-1083).
//
// ONE blob governs every consumer filter surface, in three tiers:
//
//   GENERAL   — the law. Which of the six modules exist at all, what the sheet
//               opens on, the bounds a surface may not exceed, how the store
//               behaves.
//   SURFACES  — one screen each: Home's five modes (Swipe · Catalog · Chat ·
//               Social · Favorites) then Search's two layers (Map · Search).
//               A surface either inherits the law or overrides it. `inherit` is
//               a real third state, not a synonym for `on`: it tracks General
//               when General changes.
//   SEARCHBAR — the one behaviour the module vocabulary cannot describe. The
//               other seven surfaces narrow a pool they were handed; the
//               searchbar goes and asks for one. See SearchbarFilters.
//
// Two surfaces are not what a quick read suggests. CATALOG is parked — the
// consumer route redirects, so its knobs are doubly inert. FAVORITES is the
// opposite: live, unparked, and SHEETLESS. It carries no Filters trigger at
// all, and its tab exists so the strip matches Home's five modes rather than
// implying four. `live`, `hasSheet` and `enabled` are three different claims.
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
  | "favorites"
  | "map"
  | "search";

// Home's five modes in HomeModeNav order, then Search's two layers — the order
// a guest meets them. Favorites is the fifth Home mode, not an afterthought:
// leaving it out of this list is what made the tab strip claim Home had four.
export const SURFACE_KEYS = [
  "swipe",
  "catalog",
  "chat",
  "social",
  "favorites",
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
    /**
     * False when the surface renders places but offers no Filters trigger at
     * all. A THIRD axis, not a synonym for `live` or `enabled`: Favorites is
     * live, unparked, and sheetless. Knobs on a sheetless surface describe what
     * a sheet WOULD do if one were added, so the page has to say that out loud
     * — otherwise an operator reads the silence as "filters are off here",
     * which is a different and wrong claim.
     */
    hasSheet: boolean;
  }
> = {
  swipe: {
    label: "Swipe",
    blurb:
      "Home › Swipe — the card deck. The only surface that applies Random, since ordering is all a deck is.",
    live: true,
    parkedNote: "",
    hasSheet: true,
  },
  catalog: {
    label: "Catalog",
    blurb: "Home › Catalog — the grid of every place.",
    live: false,
    parkedNote:
      "The Catalog mode is parked in the consumer app: the pill opens a coming-soon dialog and the route redirects to Swipe. CatalogGrid works — un-parking is a flag plus the page body.",
    hasSheet: true,
  },
  chat: {
    label: "Chat",
    blurb:
      "Home › Chat — Don Memo. The only surface with an agent behind it, so Memo's own config lives here too rather than as a sibling of the surface it powers.",
    live: false,
    parkedNote:
      "The Chat mode is parked in the consumer app: /home/chat redirects to Swipe and the pill opens a coming-soon dialog.",
    hasSheet: true,
  },
  social: {
    label: "Social",
    blurb: "Home › Social — global activity.",
    live: false,
    parkedNote:
      "The Social mode is parked in the consumer app: the pill opens a coming-soon dialog and the route redirects to Swipe.",
    hasSheet: true,
  },
  favorites: {
    label: "Favorites",
    blurb:
      "Home › Favorites — the places a guest saved by swiping right. The one surface a guest fills himself, so there is nothing to narrow that he did not already choose.",
    live: true,
    parkedNote: "",
    // Favorites resolves saved ids against the shared deck and renders them.
    // There is no Filters trigger on the screen and never has been. The tab
    // exists so the strip matches Home's five modes — an operator counting
    // tabs should not conclude the product has four.
    hasSheet: false,
  },
  map: {
    label: "Map",
    blurb:
      "Search › the map layer — the pin set. Random is deliberately inert here: shuffling pins on a map means nothing.",
    live: true,
    parkedNote: "",
    hasSheet: true,
  },
  search: {
    label: "Search",
    blurb:
      "Search › the searchbar and result list — free-text matching over name, zone and category, on top of the sheet.",
    live: true,
    parkedNote: "",
    hasSheet: true,
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

/**
 * The SEARCHBAR on the Search tab — a different kind of thing from everything
 * above, which is why it gets its own block rather than a seventh module.
 *
 * Every other surface NARROWS a pool it was handed. Search goes and ASKS for
 * one: ≥N characters triggers a debounced call to consumer-web-suggest-places,
 * whose rows come back split "On Mesita" / "From Google", and a Google row
 * carries the Add flow that generates the place into the catalog on the spot.
 * None of the six modules describes any of that, so the sheet's vocabulary
 * can't reach it — hence a sibling block on the surface's own tab, the same
 * shape Memo's config takes on the Chat tab.
 *
 * The values mirror SearchClient.tsx exactly (MIN_SUGGEST_QUERY_LENGTH,
 * SUGGEST_DEBOUNCE_MS) and the shipped two-group result panel. Changing one
 * here is a proposal; changing SearchClient is the change.
 */
export type SearchbarFilters = {
  /** Characters typed before the first autocomplete call goes out. */
  minQueryLength: number;
  /** Debounce after the last keystroke — one call per pause, not per keystroke. */
  debounceMs: number;
  /** Whether not-on-Mesita rows render under "From Google" at all. */
  googleResults: boolean;
  /** Whether a "From Google" row carries the Add flow that creates the place. */
  addFromGoogle: boolean;
  /** Rows rendered under "On Mesita"; null = no cap. */
  mesitaResultCap: number | null;
  /** Rows rendered under "From Google"; null = no cap. */
  googleResultCap: number | null;
};

export type FiltersConfig = {
  version: 1;
  general: GeneralFilters;
  surfaces: Record<SurfaceKey, SurfaceFilters>;
  /** The Search searchbar's own behaviour — distinct from surfaces.search, which is its filter sheet. */
  searchbar: SearchbarFilters;
};

// ── Defaults ────────────────────────────────────────────────────────────────
// These mirror the SHIPPED consumer engine. Changing one here is a proposal;
// changing the engine is the change.
export const DISTANCE_FLOOR_KM = 1;
export const DISTANCE_CEILING_KM = 200;
export const RANDOMNESS_CEILING = 4;
export const CATEGORY_CAP_CEILING = 40;
export const RESULT_CAP_CEILING = 500;
// Searchbar ceilings. A query threshold past a handful of characters would
// make the bar feel broken, and a debounce past two seconds reads as a hang.
export const QUERY_LENGTH_CEILING = 6;
export const DEBOUNCE_CEILING_MS = 2000;
// Suggest rows are one line each and share the panel with the map — a cap in
// the hundreds would be a scroll, not a result list.
export const SEARCH_RESULT_CAP_CEILING = 25;
// Below this the debounce stops collapsing keystrokes into one call.
export const DEBOUNCE_ADVISORY_MS = 150;

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
    // Live, but sheetless — `false` is the honest launch value here, and it
    // means something different from Catalog's `false` above, which is parked.
    favorites: defaultSurface(false),
    map: defaultSurface(true),
    search: defaultSurface(true),
  },
  searchbar: {
    minQueryLength: 2,
    debounceMs: 300,
    googleResults: true,
    addFromGoogle: true,
    mesitaResultCap: null,
    googleResultCap: null,
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
  // A sheetless surface is `enabled: false` forever, so the "disabled" line
  // below would fire on every load and read as a defect to fix. The honest
  // contradiction on a sheetless surface is the opposite one: switching
  // filters ON for a screen that has no trigger to switch on.
  if (!SURFACE_META[key].hasSheet) {
    if (surface.enabled) {
      out.push(
        "Filters are on here, but this surface has no Filters trigger — the switch describes a sheet nobody has built yet.",
      );
    }
  } else if (!surface.enabled && MODULE_KEYS.some((k) => resolved.modules[k])) {
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

/**
 * Contradictions inside the searchbar block. Same house rule as the rest of the
 * page — report, never auto-correct. A deliberate "Google rows off" is a choice
 * and gets no warning; a knob that can never take effect gets one.
 */
export function searchbarWarnings(cfg: FiltersConfig): string[] {
  const bar = cfg.searchbar;
  const out: string[] = [];

  if (bar.addFromGoogle && !bar.googleResults) {
    out.push(
      "Adding from Google is on, but Google rows never render — the Add flow has nothing to attach to.",
    );
  }
  if (bar.googleResultCap !== null && !bar.googleResults) {
    out.push(
      "A Google row cap is set, but Google rows never render, so the cap can't apply.",
    );
  }
  if (bar.minQueryLength <= 1) {
    out.push(
      `A ${bar.minQueryLength}-character threshold sends an autocomplete call on nearly every keystroke.`,
    );
  }
  if (bar.debounceMs < DEBOUNCE_ADVISORY_MS) {
    out.push(
      `A ${bar.debounceMs} ms debounce is below the ${DEBOUNCE_ADVISORY_MS} ms where keystrokes stop collapsing into one call — a fast typist bills a Google call per letter.`,
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

/** A row cap that survives as null — null means "no cap", not "missing". */
function nullableCap(v: unknown, ceiling: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return int(v, ceiling, 1, ceiling);
}

function coerceSearchbar(raw: unknown): SearchbarFilters {
  const d = DEFAULT_FILTERS.searchbar;
  if (!isBlob(raw)) return structuredClone(d);

  return {
    minQueryLength: int(
      raw.minQueryLength,
      d.minQueryLength,
      1,
      QUERY_LENGTH_CEILING,
    ),
    // Floor of 0 is legal and means "no debounce" — expensive, warned about,
    // not forbidden. The operator owns that call.
    debounceMs: int(raw.debounceMs, d.debounceMs, 0, DEBOUNCE_CEILING_MS),
    googleResults: bool(raw.googleResults, d.googleResults),
    addFromGoogle: bool(raw.addFromGoogle, d.addFromGoogle),
    mesitaResultCap: nullableCap(
      raw.mesitaResultCap,
      SEARCH_RESULT_CAP_CEILING,
    ),
    googleResultCap: nullableCap(
      raw.googleResultCap,
      SEARCH_RESULT_CAP_CEILING,
    ),
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
    searchbar: coerceSearchbar(raw.searchbar),
  };
}
