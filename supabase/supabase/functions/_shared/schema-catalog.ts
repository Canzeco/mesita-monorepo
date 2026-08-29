// The sub-schema catalog (MESITA-1247, "Mesita as documents" §C).
//
// Recurring shapes, defined ONCE and composed into the aggregate validators
// this issue's follow-ups build (MESITA-1248-1251). This file does not
// change how anything is written today — it names shapes that already exist
// scattered across the codebase, so the validators that come next compose
// them instead of re-typing them per aggregate.
//
// TWO of the four are aliases of ALREADY-LAW code, on purpose. The Notion
// spec names ChannelSet "already law in _shared/channels.ts — the proof",
// and the same is true of the enrichment ladder: reinventing either here
// would be exactly the kind of duplicate-source-of-truth this catalog exists
// to prevent. Import the real thing; do not re-type it.

import type { ChannelKey, Channels } from "./channels.ts";
import {
  PULSE_EXTRA_ALIASES,
  PULSE_EXTRAS,
  PULSE_PIECES,
  PULSE_TOTAL,
  pulseBlockedAt,
  pulseHighWater,
  type PulseBlock,
  type PulseEvent,
  type PulseStep,
} from "./pulse-pieces.ts";
import { enumOf, nullable, num, object, refine, str, type Schema } from "./doc-schema.ts";

// ── Money ────────────────────────────────────────────────────────────────
//
// The canonical in-code money value: an integer minor-unit amount plus its
// currency, always together — the codebase has never let one travel without
// the other (stripe-billing.ts's ResolvedPrice, ticket-bill-payload.ts's
// formatMoneyMx, every *_cents column). This is the VALUE shape, not a row
// shape: DB columns stay their own names (price_cents, bill_subtotal_cents,
// tip_cents, discount_cents, ...) because one row can carry several money
// values that need distinct names; this is what a function returns or a
// validator produces once it has picked one out.
export type Money = {
  /** Integer minor units (centavos for MXN). Never a float. */
  cents: number;
  /** Uppercase ISO 4217, e.g. "MXN" — ResolvedPrice's convention. */
  currency: string;
};

export function isMoney(v: unknown): v is Money {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.cents === "number" &&
    Number.isInteger(m.cents) &&
    typeof m.currency === "string" &&
    m.currency.length > 0
  );
}

// ── BillingState ─────────────────────────────────────────────────────────
//
// "Place billing ≡ consumer billing" (Atlas §C) is not an aspiration — it is
// already true and unenforced. project_plans and consumer_plans are two
// tables with the identical three-column shape, and stripe-billing.ts's
// private `PlanRow` (price_cents, currency, stripe_price_id) already reads
// both through it without knowing which table it is talking to. This gives
// that shape a public name so the next file that needs it imports one type
// instead of re-declaring PlanRow a third time.
//
// Deliberately NOT wired into stripe-billing.ts by this PR — that file works
// today, touches real payment code, and swapping its private type for this
// public one is a one-line, zero-risk follow-up, not part of the foundation.
// KNOWN DIVERGENCE (MESITA-1247 survey, not resolved here — needs a product
// decision): project_subscriptions carries plan_key (FK -> business_plans);
// consumer_subscriptions has no equivalent column, though every other column
// between the two tables matches. Does consumer billing need multi-plan
// support, or is business's plan_key the actual outlier? Whoever answers
// that should also decide whether BillingState should grow an optional
// plan_key or stay as-is. Left alone on purpose.
export type BillingState = {
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
};

export function isBillingState(v: unknown): v is BillingState {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.price_cents === "number" &&
    Number.isInteger(b.price_cents) &&
    typeof b.currency === "string" &&
    b.currency.length > 0 &&
    (b.stripe_price_id === null || typeof b.stripe_price_id === "string")
  );
}

// ── ChannelSet ───────────────────────────────────────────────────────────
//
// A straight re-export. channels.ts's `ChannelKey` union + `Channels` record
// already IS this sub-schema — closed key set, one column per channel, the
// exact shape §C asks for. Aliased here under the catalog's name so a
// validator composing sub-schemas finds it in one place; the type itself
// still lives, and is still maintained, in channels.ts.
//
// KNOWN DIVERGENCE (MESITA-1247 survey, a pure technical decision, not a
// product one): `places` still carries three dead columns from before they
// were retired from the channel set — tiktok_url, tripadvisor_url,
// yelp_url (added 0003_venue_links.sql / 0007_venue_links_more.sql /
// 20260625140000_venue_yelp_url.sql, never dropped). rappi_url and
// youtube_url, added in the same original migrations, WERE properly dropped
// later (20260625150000/20260625161000) — that's the precedent for cleaning
// these three up too. Not executed here: see the migration this PR ships
// alongside this comment (P2/stretch) — the decision is the required part
// of this reconciliation, executing it is not.
export type ChannelSetKey = ChannelKey;
export type ChannelSet = Channels;

// ── FunctionState ────────────────────────────────────────────────────────
//
// "{status, at, detail} x 10 enrichment functions" — the 10 is not a round
// number, it is PULSE_PIECES.length (Pulse through Embedding), the exact
// closed set pulse-pieces.ts already defines and pulse-report.ts already
// writes through StampablePulseStep. FunctionState formalizes the PER-STEP
// record that MESITA-1249 (materializing the enrichment state map onto the
// place) will need to store; today that state lives only in the append-only
// event log pulse-pieces.ts folds over. Defining the type here does not
// materialize anything — it gives 1249 a name to build against instead of
// inventing its own shape.
// KNOWN GAP (MESITA-1247 survey, deliberately left for MESITA-1249, which
// owns materializing this map): the DB event log's `started` and `skipped`
// statuses (place_enrichment_events.status CHECK) have no home in this
// three-value enum, and the write-side PieceOutcome (pulse-report.ts) is
// narrower still (`completed | failed`, no `pending`). Whether `skipped`
// projects as `completed` (skipped but fine), needs a fourth status, or
// something else, is 1249's call — don't let it get decided by accident
// when this map's first real writer lands. `detail` being nullable here
// while PieceOutcome.detail is not is correct as designed, not a bug: this
// type has to represent `pending` (never run, no detail to report), a state
// PieceOutcome structurally cannot hold since a piece that hasn't run never
// gets a PieceOutcome written at all.
export type FunctionState = {
  status: "pending" | "completed" | "failed";
  /** ISO timestamp of the latest event for this step, or null if never run. */
  at: string | null;
  detail: string | null;
};

/** The closed key set FunctionState is indexed by — every PULSE step, no other. */
export type FunctionStateMap = Partial<Record<PulseStep, FunctionState>>;

export function isFunctionState(v: unknown): v is FunctionState {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    (f.status === "pending" || f.status === "completed" || f.status === "failed") &&
    (f.at === null || typeof f.at === "string") &&
    (f.detail === null || typeof f.detail === "string")
  );
}

/**
 * The closed set of keys FunctionState may be indexed by, re-derived from
 * pulse-pieces.ts rather than hand-typed — the same derivation discipline
 * PULSE_PIECE_META already enforces (MESITA-1222: an index written down
 * beside its source drifts; one derived from it cannot).
 */
export const FUNCTION_STATE_KEYS: readonly PulseStep[] = [
  ...PULSE_PIECES,
  ...PULSE_EXTRAS,
];

export const FunctionStateSchema: Schema<FunctionState> = object({
  status: enumOf(["pending", "completed", "failed"] as const),
  at: nullable(str()),
  detail: nullable(str()),
});

/**
 * A `FunctionStateMap` is a PARTIAL record — most places have not run every
 * one of the 10 steps yet, and an absent key means exactly that, not
 * `{status:"pending",...}`. `object()` iterates every key of its shape
 * regardless of presence, which is the right behavior for a fixed-shape
 * document (place-doc.ts's own PlacePatch keys) but wrong here: a place
 * that has only run `pulse` must round-trip as `{pulse: {...}}`, not as
 * all 10 keys with 9 fabricated `pending` entries. Bespoke, small, and
 * kept local rather than promoted into doc-schema.ts's core until a SECOND
 * partial-record shape needs it too.
 */
const FUNCTION_STATE_PARSE_KEYS: readonly string[] = [
  ...FUNCTION_STATE_KEYS,
  ...PULSE_EXTRA_ALIASES,
];

function laterAt(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function foldSemanticPair(
  name: FunctionState | undefined,
  summary: FunctionState | undefined,
): FunctionState | undefined {
  const parts = [name, summary].filter((p): p is FunctionState => p != null);
  if (parts.length === 0) return undefined;
  const failed = parts.find((p) => p.status === "failed");
  const completed = parts.filter((p) => p.status === "completed");
  const at = parts.reduce<string | null>((acc, p) => laterAt(acc, p.at), null);
  if (failed) {
    return { status: "failed", at, detail: failed.detail };
  }
  if (completed.length > 0) {
    const detail = completed
      .map((p) => p.detail)
      .filter((d): d is string => typeof d === "string" && d.length > 0)
      .join(" · ") || null;
    return { status: "completed", at, detail };
  }
  return { status: "pending", at, detail: null };
}

/**
 * Fold legacy keys into `embedding`: the rename (`semantic`, the same
 * function 10 under its pre-§8.4-v3 name) and the pre-merge `name`/`summary`
 * extras. Precedence: a real `embedding` stamp wins, then `semantic`, then
 * the folded extras pair.
 */
export function foldFunctionStateMap(
  map: Partial<Record<string, FunctionState>>,
): FunctionStateMap {
  const embedding = map.embedding ?? map.semantic ??
    foldSemanticPair(map.name, map.summary);
  const out: FunctionStateMap = {};
  for (const key of PULSE_PIECES) {
    const rec = map[key];
    if (rec) out[key] = rec;
  }
  if (embedding) out.embedding = embedding;
  return out;
}


/**
 * The ten Enrich operator functions (1–10), every key present
 * so Status can list them without inventing a second ladder.
 */
export function operatorFunctionStates(
  map: Partial<Record<string, FunctionState>>,
): Record<string, FunctionState> {
  const folded = foldFunctionStateMap(map);
  const out: Record<string, FunctionState> = {};
  for (const key of FUNCTION_STATE_KEYS) {
    out[key] = folded[key] ?? { status: "pending", at: null, detail: null };
  }
  return out;
}

export const FunctionStateMapSchema: Schema<FunctionStateMap> = {
  parse(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { ok: false, error: `expected object, got ${typeof raw}` };
    }
    const rawObj = raw as Record<string, unknown>;
    const unknownKeys = Object.keys(rawObj).filter(
      (k) => !FUNCTION_STATE_PARSE_KEYS.includes(k),
    );
    if (unknownKeys.length > 0) {
      return { ok: false, error: `unknown pulse step(s): ${unknownKeys.join(", ")}` };
    }
    const value: Record<string, FunctionState> = {};
    for (const key of Object.keys(rawObj)) {
      const r = FunctionStateSchema.parse(rawObj[key]);
      if (!r.ok) return { ok: false, error: `${key}: ${r.error}` };
      value[key] = r.value;
    }
    return { ok: true, value: foldFunctionStateMap(value) };
  },
};

const PulseBlockSchema: Schema<PulseBlock> = object({
  key: enumOf(PULSE_PIECES),
  index: refine(num(), (v) => Number.isInteger(v) && v >= 1 && v <= PULSE_TOTAL ? null : `index must be an integer between 1 and ${PULSE_TOTAL}`),
  status: enumOf(["failed", "missing"] as const),
});

// ── The materialized enrichment state map (MESITA-1249) ────────────────────
//
// `places.enrichment`: the ONE-READ replacement for "RPC + fold over
// place_enrichment_events on every request" (admin-web-search-places,
// business-web-get-overview). `functions`/`highWater`/`blockedAt` are the
// exact three values `pulseHighWater`/`pulseBlockedAt` already compute from
// the event log — this materializes their OUTPUT, kept current by
// pulse-report.ts's `reportPulsePieces` merging into it on every write,
// instead of re-deriving it from scratch on every read.
//
// DELIBERATELY NOT in this shape: `everyDays`/`mode`/`nextAt`/`lastRunAt`
// (the schedule). The issue that named this map asked for those too, but
// `places.enrich_every_days`/`enrich_mode`/`enrich_next_at` are read AND
// WRITTEN directly by `queue_due_place_enrichments`, a live PL/pgSQL cron
// function — the exact class of change (a rename/restructure a stored
// function body doesn't auto-follow) that caused this repo's own documented
// 2-day enrichment outage (MESITA-1143). Folding the meter (a pure read-path
// win, zero cron risk) and folding the schedule (a real risk to a fragile
// live function) are two different shapes of change; this ships the first
// and leaves the second an explicit, separate decision. The three scalar
// columns are unchanged and still the source of truth for scheduling.
export type EnrichmentMap = {
  functions: FunctionStateMap;
  highWater: number;
  blockedAt: PulseBlock | null;
};

export const EnrichmentMapSchema: Schema<EnrichmentMap> = object({
  functions: FunctionStateMapSchema,
  highWater: refine(num(), (v) => Number.isInteger(v) && v >= 0 && v <= PULSE_TOTAL ? null : `highWater must be an integer between 0 and ${PULSE_TOTAL}`),
  blockedAt: nullable(PulseBlockSchema),
});

/**
 * `pulseHighWater`/`pulseBlockedAt` (pulse-pieces.ts) walk a raw
 * `PulseEvent[]` fetched fresh from `place_enrichment_events`. These two
 * walk the SAME logic over an already-materialized `FunctionStateMap`
 * instead, by converting the map back into the event shape those two
 * functions (and their 28 pinned tests) already handle — not a second walk
 * implementation to keep in sync by hand.
 */
function functionStateMapToEvents(map: FunctionStateMap): PulseEvent[] {
  return PULSE_PIECES.flatMap((piece) => {
    const rec = map[piece];
    if (!rec) return [];
    return [{ step_name: piece, status: rec.status, created_at: rec.at ?? "" }];
  });
}

export function pulseHighWaterFromMap(map: FunctionStateMap): number {
  return pulseHighWater(functionStateMapToEvents(map));
}

export function pulseBlockedAtFromMap(map: FunctionStateMap): PulseBlock | null {
  return pulseBlockedAt(functionStateMapToEvents(map));
}

/**
 * Raw `place_enrichment_events.status` -> `FunctionState.status`. Only
 * needed for translating HISTORICAL event rows (the migration backfill) —
 * the live write path (pulse-report.ts) only ever produces `PieceOutcome`,
 * whose status is already `"completed" | "failed"`, a strict subset of
 * `FunctionState.status`, so it never needs this mapping.
 *
 * `completed` stays itself. `started` (in-flight, no outcome yet) becomes
 * `pending`. Everything else — `failed`, the `skipped` a legacy row might
 * carry, or an unrecognized value — becomes `failed`. This is not a new
 * rule: it is `pulseBlockedAt`'s own documented one ("anything not
 * completed and not absent is the function having run and not delivered"),
 * applied here rather than invented — the decision this map's header
 * flagged as 1249's to make is "reuse the ladder's existing skipped-is-a-
 * form-of-failed rule", not a fresh one.
 */
export function toFunctionStatus(rawStatus: string): FunctionState["status"] {
  if (rawStatus === "completed") return "completed";
  if (rawStatus === "started") return "pending";
  return "failed";
}
