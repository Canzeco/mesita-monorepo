// Enrichment trigger matrix — WHICH events re-run WHICH parts of the pipeline.
//
// Enrichment is not one button. It is a set of subprocesses with very different
// costs (a Google Place Details refetch is cents; a vision pass over 50 images
// is dollars), and the events that should provoke them are equally different. A
// place created for the first time earns the whole pipeline. A guest walking in
// earns a cheap liveness refresh and nothing else — a visit that costs a dollar
// would bankrupt the catalog by lunchtime.
//
// So the config is a GRID: trigger (row) x subprocess (column), plus a per-row
// cooldown so a busy place cannot be re-enriched on every event.
//
// WHAT THIS IS NOT. A trigger re-derives facts from external sources. It cannot
// carry a fact the sources do not have: when the Reservationist learns on a call
// that the hours are wrong, re-running function 2 refetches the SAME wrong hours from
// Google. That is a CORRECTION — a proposed field write with provenance and a
// pin so the next scheduled run cannot clobber it — and it is deliberately not
// modelled here. Conflating the two is how a corrected place silently reverts.
//
// The KEYS below are code-defined (same contract as channels.ts): the admin
// console edits the booleans, never the vocabulary.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/** One unit of enrichment work, cut at a seam the pipeline can actually skip. */
export type SubprocessKey =
  | "google"
  | "reviews"
  | "serp"
  | "links"
  | "social"
  | "images"
  | "synthesis"
  | "photos"
  | "embedding";

/** An event that may provoke enrichment. */
export type TriggerKey =
  | "on_create"
  | "on_update"
  | "on_schedule"
  | "on_visit"
  | "on_order"
  | "on_reservation_ok"
  | "on_reservation_failed";

export const SUBPROCESS_KEYS: SubprocessKey[] = [
  "google",
  "reviews",
  "serp",
  "links",
  "social",
  "images",
  "synthesis",
  "photos",
  "embedding",
];

export const TRIGGER_KEYS: TriggerKey[] = [
  "on_create",
  "on_update",
  "on_schedule",
  "on_visit",
  "on_order",
  "on_reservation_ok",
  "on_reservation_failed",
];

/**
 * What a RUN can be provoked by — the matrix's seven, plus `manual` (MESITA-1185).
 *
 * `manual` is deliberately NOT a TriggerKey. The Run-now button opts OUT of the
 * matrix on both axes: it clears `subprocesses` to null ("run everything",
 * because explicit operator intent outranks the grid) and it ignores cooldown.
 * Adding it to TriggerKey would draw a phantom eighth row in the console grid
 * carrying nine checkboxes and a cooldown the button must ignore — an unenforced
 * config, which is the house definition of a bug.
 *
 * So the two vocabularies are siblings, not one list: TRIGGER_KEYS is what the
 * matrix PRICES, RUN_TRIGGERS is what the history RECORDS. This list is pinned
 * against the DB CHECK by a test, the same way pulse-pieces.test.ts pins the
 * `step ~ '^S[0-9]$'` constraint from TypeScript.
 */
export const RUN_TRIGGERS = [...TRIGGER_KEYS, "manual"] as const;

export type RunTrigger = TriggerKey | "manual";

/** Rough per-run spend, for the console's cost column. */
export type CostTier = "free" | "low" | "high";

/**
 * ONE LADDER, ONE PLACE (Docs › Enrichment §A, §D).
 *
 * `functions` names which of the TEN functions a purchase unit buys — it is a
 * pointer INTO §A's numbering, never a numbering of its own. This field used to
 * hold stage S-numbers (S1, S2, S5–S6…), which made a second ladder: an
 * operator reading "SERP · S2" beside a doc that calls SERP function 3 has two
 * answers to one question. The mapping is deliberately one-way and not
 * one-to-one — `google` buys two functions, `photos` buys none (it is the
 * storage mirror), `embedding` buys the semantic pair that sits outside the
 * count entirely.
 */
export const SUBPROCESS_META: Record<
  SubprocessKey,
  { label: string; functions: string; cost: CostTier; blurb: string }
> = {
  google: {
    label: "Google",
    functions: "1–2",
    cost: "low",
    blurb:
      "Place Details by ID — hours, rating, review count, phone, geo, price.",
  },
  reviews: {
    label: "Reviews",
    functions: "8",
    cost: "high",
    blurb: "Apify Google Maps scrape — the newest reviews that ground the Presentation.",
  },
  serp: {
    label: "SERP",
    functions: "3",
    cost: "low",
    blurb: "Agent X editorial read of the open web. Soft context, never facts.",
  },
  links: {
    label: "Links",
    functions: "4",
    cost: "high",
    blurb:
      "Firecrawl Search per source, then Agent Y picks the winning channel.",
  },
  social: {
    label: "Social",
    functions: "5",
    cost: "high",
    blurb:
      "Apify Instagram + Facebook — followers, bio, posts, identity judge.",
  },
  images: {
    label: "Images",
    functions: "6",
    cost: "high",
    blurb:
      "Describe every candidate with vision, then rank and pick the gallery.",
  },
  synthesis: {
    label: "Synthesis",
    functions: "9",
    cost: "low",
    blurb:
      "The Presentation, then category and tags grounded on it. Rewrites the profile.",
  },
  photos: {
    label: "Photos",
    functions: "—",
    cost: "free",
    blurb: "Mirror the winning photos into the place-images bucket.",
  },
  embedding: {
    label: "Embedding",
    functions: "◇",
    cost: "free",
    blurb: "Re-vectorize the place so search and recall see the new text.",
  },
};

export const TRIGGER_META: Record<
  TriggerKey,
  { label: string; blurb: string; staged: boolean }
> = {
  on_create: {
    label: "On create",
    blurb:
      "A place enters Mesita. The only chance to build a profile from nothing.",
    staged: false,
  },
  on_update: {
    label: "On update",
    blurb:
      "Someone edited the profile. A human just stated the truth, so nothing re-scrapes.",
    // STAGED, not live. `subprocessesFor` is only ever called with "on_create"
    // (create-place.ts:187); on_schedule is resolved in SQL by
    // queue_due_place_enrichments. Nothing emits on_update, so a `staged:false`
    // here badged a dead row as live — and the console now SPLITS the grid on
    // this flag, so the lie would have promoted it into the live table.
    staged: true,
  },
  on_schedule: {
    label: "On schedule",
    blurb:
      "Per-place decay refresh, every enrich_every_days. The expensive one.",
    staged: false,
  },
  on_visit: {
    label: "On visit",
    blurb:
      "A ticket was validated at the table. Proof the place is alive and trading.",
    staged: true,
  },
  on_order: {
    label: "On order",
    blurb:
      "An order closed. Same liveness signal as a visit, from the remote context.",
    staged: true,
  },
  on_reservation_ok: {
    label: "On reservation · ok",
    blurb:
      "The Reservationist got through and booked. The channel works; little to learn.",
    staged: true,
  },
  on_reservation_failed: {
    label: "On reservation · failed",
    blurb:
      "The call failed — wrong number, unreachable, closed. The stored channel is provably stale.",
    staged: true,
  },
};

export type TriggerRow = {
  enabled: boolean;
  /** Minimum hours between two runs of this trigger for the same place. */
  cooldownHours: number;
  subprocesses: Record<SubprocessKey, boolean>;
};

export type EnrichmentTriggersConfig = Record<TriggerKey, TriggerRow>;

// A cell the operator does not get to decide, and why. Drives both the
// normalizer and the console (which renders these locked, with the reason).
export function lockedCell(
  trigger: TriggerKey,
  sub: SubprocessKey,
): { value: boolean; reason: string } | null {
  if (trigger === "on_update") {
    // An edit is ground truth. Re-deriving anything would overwrite the person
    // who just told us the answer — the one way this system loses information.
    if (sub === "embedding" || sub === "social") return null;
    return {
      value: false,
      reason:
        "An edit is ground truth — re-scraping would overwrite the human who just fixed it.",
    };
  }
  if (sub === "google") {
    return {
      value: true,
      reason:
        "Place Details is the identity gate (functions 1–2); every pipeline run passes it.",
    };
  }
  return null;
}

function row(
  cooldownHours: number,
  on: SubprocessKey[],
  enabled = true,
): TriggerRow {
  const subprocesses = {} as Record<SubprocessKey, boolean>;
  for (const key of SUBPROCESS_KEYS) subprocesses[key] = on.includes(key);
  return { enabled, cooldownHours, subprocesses };
}

// Defaults encode two rules. High-frequency triggers may never spend money, so
// visit/order/reservation buy nothing beyond the Google refetch they already
// pass through. And a failed reservation is the one cheap event that earns link
// rediscovery, because it is positive evidence the stored channel is wrong.
export const ENRICHMENT_TRIGGERS_DEFAULTS: EnrichmentTriggersConfig = {
  on_create: row(0, [
    "google",
    "reviews",
    "serp",
    "links",
    "social",
    "images",
    "synthesis",
    "photos",
    "embedding",
  ]),
  on_update: row(0, ["social", "embedding"]),
  on_schedule: row(24, [
    "google",
    "reviews",
    "serp",
    "links",
    "social",
    "images",
    "synthesis",
    "photos",
    "embedding",
  ]),
  on_visit: row(168, ["google"]),
  on_order: row(168, ["google"]),
  on_reservation_ok: row(336, ["google"]),
  on_reservation_failed: row(24, ["google", "links"]),
};

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function hours(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(8760, Math.max(0, Math.round(n)));
}

/** Coerce a stored blob to the current vocabulary, filling gaps from defaults. */
export function normalizeEnrichmentTriggers(
  raw: unknown,
): EnrichmentTriggersConfig {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = {} as EnrichmentTriggersConfig;

  for (const trigger of TRIGGER_KEYS) {
    const fallback = ENRICHMENT_TRIGGERS_DEFAULTS[trigger];
    const stored = (src[trigger] ?? {}) as Record<string, unknown>;
    const storedSubs = (stored.subprocesses ?? {}) as Record<string, unknown>;
    const subprocesses = {} as Record<SubprocessKey, boolean>;

    for (const sub of SUBPROCESS_KEYS) {
      const locked = lockedCell(trigger, sub);
      subprocesses[sub] = locked
        ? locked.value
        : bool(storedSubs[sub], fallback.subprocesses[sub]);
    }

    out[trigger] = {
      enabled: bool(stored.enabled, fallback.enabled),
      cooldownHours: hours(stored.cooldownHours, fallback.cooldownHours),
      subprocesses,
    };
  }

  return out;
}

/**
 * The subprocess set a trigger buys, as the list persisted on the
 * place_research row. An empty list means the trigger is off — do not seed.
 */
export function subprocessesFor(
  cfg: EnrichmentTriggersConfig,
  trigger: TriggerKey,
): SubprocessKey[] {
  const t = cfg[trigger];
  if (!t?.enabled) return [];
  return SUBPROCESS_KEYS.filter((key) => t.subprocesses[key]);
}

/**
 * Read side for the stage EFs. `null`/absent means a row seeded before this
 * feature (or by a caller with explicit operator intent, e.g. the manual
 * re-enrich button) — those run everything, which is the pre-matrix behaviour.
 */
export function wants(
  stored: unknown,
  sub: SubprocessKey,
): boolean {
  if (!Array.isArray(stored)) return true;
  return stored.includes(sub);
}

/**
 * Read the matrix from the app_config singleton. A missing blob is not an
 * error: the code defaults ARE the shipped policy, so a fresh environment
 * enriches correctly before anyone opens the console.
 */
export async function loadEnrichmentTriggers(
  admin: SupabaseClient,
): Promise<EnrichmentTriggersConfig> {
  const { data, error } = await admin
    .from("app_config")
    .select("enrichment_triggers")
    .order("id")
    .limit(1)
    .maybeSingle();

  if (error) {
    // Never fail a run over config: fall back to the defaults and say so.
    console.error("[enrich-triggers] load:", error.message);
    return ENRICHMENT_TRIGGERS_DEFAULTS;
  }

  const row = data as { enrichment_triggers: unknown } | null;
  return normalizeEnrichmentTriggers(row?.enrichment_triggers ?? null);
}

/**
 * Everything the console needs to RENDER the grid, derived from the code
 * vocabulary above. Published by admin-web-get-config so the admin app never
 * keeps its own copy of the trigger/subprocess list — a second copy is a second
 * source of truth, and this one would drift silently the first time a
 * subprocess is added.
 */
export type EnrichmentTriggersMeta = {
  triggers: {
    key: TriggerKey;
    label: string;
    blurb: string;
    staged: boolean;
  }[];
  subprocesses: {
    key: SubprocessKey;
    label: string;
    /** Which of §A's TEN functions this unit buys. See SUBPROCESS_META. */
    functions: string;
    cost: CostTier;
    blurb: string;
  }[];
  /** locks[trigger][subprocess] — a cell the operator cannot flip, and why. */
  locks: Record<string, Record<string, { value: boolean; reason: string }>>;
};

export function enrichmentTriggersMeta(): EnrichmentTriggersMeta {
  const locks: EnrichmentTriggersMeta["locks"] = {};
  for (const trigger of TRIGGER_KEYS) {
    const row: Record<string, { value: boolean; reason: string }> = {};
    for (const sub of SUBPROCESS_KEYS) {
      const locked = lockedCell(trigger, sub);
      if (locked) row[sub] = locked;
    }
    locks[trigger] = row;
  }

  return {
    triggers: TRIGGER_KEYS.map((key) => ({ key, ...TRIGGER_META[key] })),
    subprocesses: SUBPROCESS_KEYS.map((key) => ({
      key,
      ...SUBPROCESS_META[key],
    })),
    locks,
  };
}
