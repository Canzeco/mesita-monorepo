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
import { PULSE_EXTRAS, PULSE_PIECES, type PulseStep } from "./pulse-pieces.ts";

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
export type ChannelSetKey = ChannelKey;
export type ChannelSet = Channels;

// ── FunctionState ────────────────────────────────────────────────────────
//
// "{status, at, detail} x 11 enrichment functions" — the 11 is not a round
// number, it is PULSE_PIECES.length (9) + PULSE_EXTRAS.length (2), the exact
// closed set pulse-pieces.ts already defines and pulse-report.ts already
// writes through StampablePulseStep. FunctionState formalizes the PER-STEP
// record that MESITA-1249 (materializing the enrichment state map onto the
// place) will need to store; today that state lives only in the append-only
// event log pulse-pieces.ts folds over. Defining the type here does not
// materialize anything — it gives 1249 a name to build against instead of
// inventing its own shape.
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
