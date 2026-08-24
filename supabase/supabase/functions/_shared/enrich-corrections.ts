// Corrections — the OTHER half of enrichment feedback.
//
// A trigger re-derives facts from external sources. It cannot carry a fact the
// sources do not have. When the Reservationist calls a place and learns the
// hours are Tue–Sun rather than Mon–Sat, re-running S1 refetches the SAME wrong
// hours from Google: the agent's knowledge is better than every source the
// Intaker can reach, and a re-enrich would destroy it.
//
// So agent feedback is not a trigger. It is a PROPOSAL — a field, a value, who
// observed it, how sure they are, and what they saw — which either applies
// itself (high confidence, trusted source) or queues for a human in the
// Verification Queue. Applying one PINS the field, and the persist steps must
// skip a pinned field, or the next scheduled run silently reverts the
// correction and every call is wrong again. That loop is the whole reason this
// file exists.
//
// Deliberately NOT modelled here: anything that re-fetches. That is the trigger
// matrix in enrich-triggers.ts, and the two must not merge.
//
// ━━━ WHAT IS BUILT (MESITA-1190) ━━━
// The PIN HALF is live. `readFieldPins` / `carryFieldPins` / `stripPinnedColumns`
// are wired into the two EFs that persist enriched facts onto `places`:
// supabase-cron-enrich-place-research (phone) and
// supabase-cron-enrich-place-contents (everything else). A pin that exists is
// obeyed today.
//
// ━━━ WHAT IS NOT ━━━
// Nothing WRITES a pin yet. There is no `place_field_proposals` table, no
// proposal writer for the Reservationist, and no routing into the Verification
// Queue — those need a migration, which is serialised by hand. `FieldProposal`,
// `CORRECTION_AUTO_APPLY_FLOOR` and `autoApplies()` below are still the types
// that engine will fill.
//
// Order is on purpose. The guard ships FIRST because the alternative — a writer
// landing while persist still clobbers — produces corrections that revert
// silently, which is worse than no corrections at all.

/** Who observed the fact. Confidence is read per-source, never globally. */
export type CorrectionSource =
  | "reservationist" // heard it on a call with the venue
  | "business" // the place's own team said so in the console
  | "consumer_report" // a guest reported it from a ticket
  | "ojo" // vision read it off a submitted proof
  | "admin"; // an operator typed it

const CORRECTION_SOURCES: readonly CorrectionSource[] = [
  "reservationist",
  "business",
  "consumer_report",
  "ojo",
  "admin",
];

/**
 * Fields an observation may correct. Deliberately small: identity (name,
 * google_place_id) and anything generated are NOT correctable — identity is the
 * spine, and generated prose is the Intaker's to rewrite.
 */
export type CorrectableField =
  | "hours"
  | "phone"
  | "reservation_target"
  | "website_url"
  | "address"
  | "closes_at";

/**
 * Correctable field → the `places` columns a pin on it must protect. One field
 * can own more than one column: the reservation endpoint is a {channel, value}
 * pair written together by `reservationTargetPatch`, so pinning one half and
 * leaving the other writable would produce a channel pointing at a stale value.
 *
 * This map is the reason the guard is a shared function rather than an `if` in
 * each EF: the column list is where a rename leaks, and there is exactly one
 * copy of it.
 */
export const CORRECTABLE_FIELD_COLUMNS: Record<
  CorrectableField,
  readonly string[]
> = {
  hours: ["hours"],
  phone: ["phone"],
  reservation_target: ["reservation_channel", "reservation_target"],
  website_url: ["website_url"],
  address: ["address"],
  closes_at: ["closes_at"],
};

const CORRECTABLE_FIELDS = Object.keys(
  CORRECTABLE_FIELD_COLUMNS,
) as CorrectableField[];

export type FieldProposal = {
  placeId: string;
  field: CorrectableField;
  /** Serialized so one shape carries hours-json and plain strings alike. */
  value: unknown;
  source: CorrectionSource;
  /** 0–1. Below the source's threshold the proposal queues instead of applying. */
  confidence: number;
  /** What was actually observed — a call snippet, a ticket id, a screenshot ref. */
  evidence: string;
  observedAt: string;
};

/**
 * Auto-apply floor per source. A call with the venue outranks a guest report on
 * hours because the venue IS the authority on its own hours; Ojo reads pixels,
 * so it proposes and a human decides.
 */
export const CORRECTION_AUTO_APPLY_FLOOR: Record<CorrectionSource, number> = {
  business: 0.0,
  admin: 0.0,
  reservationist: 0.8,
  consumer_report: 0.95,
  ojo: 1.01, // above 1 = never auto-applies, always queues
};

/** How long an applied correction outranks the Intaker for that field. */
export const CORRECTION_PIN_DAYS = 90;

/** True when a proposal may write straight through. */
export function autoApplies(p: FieldProposal): boolean {
  return p.confidence >= CORRECTION_AUTO_APPLY_FLOOR[p.source];
}

// ━━━ Pin storage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Pins live at `places.enrichment_sources.pins`. That column is jsonb and
// already on the row, so no migration is needed — but it is NOT free real
// estate, and the issue's plan missed this: `enrichment_sources` is the
// contents stage's per-run DIAGNOSTICS bag (synthesis diag, category, tags,
// cost, image funnel), and S8 assigns it WHOLESALE on every run. A pin written
// into it and left alone would be destroyed by the first re-enrich after it —
// i.e. by exactly the run it exists to survive.
//
// So the pin sub-key must be carried forward explicitly. `carryFieldPins` is
// that carry, and `enrich-corrections.test.ts` is the gate that goes red if
// someone "tidies" the blob assignment back into a plain overwrite.
//
// The alternative is a dedicated `places.field_pins` column, which is cleaner
// and costs a migration. If that ever lands, `readFieldPins` and
// `carryFieldPins` are the only two functions that move.

/** Where inside `enrichment_sources` the durable pins live. */
export const FIELD_PINS_KEY = "pins";

/** Per-field provenance for an applied correction. */
export type FieldPin = {
  source: CorrectionSource;
  /** Confidence of the proposal that won the field. */
  confidence: number;
  /** ISO. After this instant the Intaker owns the field again. */
  pinnedUntil: string;
  /** ISO. When the observation was made — kept so the console can explain a pin. */
  observedAt?: string;
};

export type FieldPins = Partial<Record<CorrectableField, FieldPin>>;

function isCorrectableField(v: unknown): v is CorrectableField {
  return typeof v === "string" &&
    (CORRECTABLE_FIELDS as string[]).includes(v);
}

function coerceFieldPin(raw: unknown): FieldPin | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const source = r.source;
  const pinnedUntil = r.pinnedUntil;
  // A pin with no source or no expiry is not a pin — it is noise that would
  // freeze a field forever. Absence of a valid record means "not pinned".
  if (
    typeof source !== "string" ||
    !(CORRECTION_SOURCES as string[]).includes(source) ||
    typeof pinnedUntil !== "string" ||
    Number.isNaN(Date.parse(pinnedUntil))
  ) return null;
  const confidence = typeof r.confidence === "number" ? r.confidence : 0;
  const observedAt = typeof r.observedAt === "string" ? r.observedAt : undefined;
  return {
    source: source as CorrectionSource,
    confidence,
    pinnedUntil,
    ...(observedAt ? { observedAt } : {}),
  };
}

/**
 * Read the pins off a live `enrichment_sources` value. Total: any shape that is
 * not a recognisable pin record yields no pin, because the failure mode of
 * guessing is a field frozen against the Intaker forever.
 */
export function readFieldPins(enrichmentSources: unknown): FieldPins {
  if (!enrichmentSources || typeof enrichmentSources !== "object") return {};
  const bag = (enrichmentSources as Record<string, unknown>)[FIELD_PINS_KEY];
  if (!bag || typeof bag !== "object") return {};
  const out: FieldPins = {};
  for (const [field, raw] of Object.entries(bag as Record<string, unknown>)) {
    if (!isCorrectableField(field)) continue;
    const pin = coerceFieldPin(raw);
    if (pin) out[field] = pin;
  }
  return out;
}

/** The fields still pinned at `now` — an expired pin is not a pin. */
export function activeFieldPins(pins: FieldPins, now = new Date()): FieldPins {
  const t = now.getTime();
  const out: FieldPins = {};
  for (const field of CORRECTABLE_FIELDS) {
    const pin = pins[field];
    if (pin && Date.parse(pin.pinnedUntil) > t) out[field] = pin;
  }
  return out;
}

/**
 * Fold the live pins into a freshly built `enrichment_sources` blob. Call this
 * on EVERY wholesale write of that column — the pins are durable state living
 * in a bag that is otherwise rebuilt per run, and a write that skips this step
 * deletes them.
 */
export function carryFieldPins(
  sources: Record<string, unknown>,
  pins: FieldPins,
): Record<string, unknown> {
  if (Object.keys(pins).length === 0) return sources;
  return { ...sources, [FIELD_PINS_KEY]: pins };
}

/**
 * Drop every column an active pin owns from a `places` update payload, so the
 * Intaker writes around the correction instead of over it. Returns the payload
 * to send plus the fields it withheld, which the caller reports — a pin that
 * silently eats a write is as confusing as one that does not hold.
 *
 * A column the payload does not carry is not "skipped": the persist contract is
 * that absent keys are untouched, so there is nothing to withhold and nothing
 * to report.
 */
export function stripPinnedColumns<T extends Record<string, unknown>>(
  update: T,
  pins: FieldPins,
  now = new Date(),
): { update: Record<string, unknown>; skipped: CorrectableField[] } {
  const active = activeFieldPins(pins, now);
  const out: Record<string, unknown> = { ...update };
  const skipped: CorrectableField[] = [];
  for (const field of Object.keys(active) as CorrectableField[]) {
    let hit = false;
    for (const column of CORRECTABLE_FIELD_COLUMNS[field]) {
      if (column in out) {
        delete out[column];
        hit = true;
      }
    }
    if (hit) skipped.push(field);
  }
  return { update: out, skipped };
}
