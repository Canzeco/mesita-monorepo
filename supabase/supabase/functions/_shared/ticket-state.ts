// THE ticket state vocabulary (MESITA-1085) — one home for every state
// set the EFs used to hardcode as inline literal arrays (~25 sites).
//
// Why this file exists: widening the `ticket_state` enum without widening
// every filter that names its labels strands live rows in a bucket no UI
// renders — a guest's ticket vanishes from their app mid-visit the moment it
// enters a state one hand-copied array forgot. From here on, a new label is
// added by editing THIS file and the migration in the same PR, never by
// hunting literals.
//
// v4 (MESITA-1086) widened this vocabulary in lockstep with the migration
// that added `scanned`, `approved`, `paying` to the enum — the machine is
// open → scanned → approved → paying → revealed (plan §12), with
// fix_requested as a COLUMN at scanned, never a state.
// `awaiting_payment_confirm` remains LIVE only while the transitional staff
// bill path (validate-web-submit-bill) still writes it; it retires with
// MESITA-1093 and then moves to LEGACY.
//
// The web/mobile apps hold a mirror of LIVE_STATES as
// `ACTIVE_TICKET_STATES` in their `lib/api/tickets.ts`; a drift test in
// web-consumer (`ticket-state-drift.test.ts`) fails the build when either
// mirror and this file disagree.

export const TICKET_STATE = {
  open: "open",
  scanned: "scanned",
  approved: "approved",
  paying: "paying",
  pendingPayment: "pending_payment",
  paid: "paid",
  cancelled: "cancelled",
  revealed: "revealed",
  awaitingStory: "awaiting_story",
  awaitingPaymentConfirm: "awaiting_payment_confirm",
} as const;

export type TicketState = (typeof TICKET_STATE)[keyof typeof TICKET_STATE];

/** Every label in public.ticket_state, in enum order. */
export const ALL_TICKET_STATES: readonly TicketState[] = [
  "open",
  "pending_payment",
  "paid",
  "cancelled",
  "revealed",
  "awaiting_story",
  "awaiting_payment_confirm",
  "scanned",
  "approved",
  "paying",
];

/**
 * A guest mid-visit: the wallet's "active" scope, the QR still resolves,
 * the ticket still shows in the app. The one set most literals encoded.
 */
export const LIVE_STATES: readonly TicketState[] = [
  "open",
  "scanned",
  "approved",
  "paying",
  "awaiting_payment_confirm",
];
export const LIVE_STATE_SET: ReadonlySet<string> = new Set(LIVE_STATES);

/** Done forever: the wallet's "history" scope. No write ever leaves here. */
export const TERMINAL_STATES: readonly TicketState[] = [
  "revealed",
  "cancelled",
];

/**
 * Enum labels no code path can reach any more (labels cannot be dropped from
 * a Postgres enum). Tolerated on read, never written.
 */
export const LEGACY_STATES: readonly TicketState[] = [
  "pending_payment",
  "paid",
  "awaiting_story",
];

/**
 * States that still accept a task submission (story / Google review /
 * Mesita review). Tasks are upside, not gates, so a billed ticket still
 * takes one — the reprice is bump-only.
 */
export const TASKABLE_STATES: readonly TicketState[] = [
  "open",
  "scanned",
  "awaiting_payment_confirm",
];
export const TASKABLE_STATE_SET: ReadonlySet<string> = new Set(
  TASKABLE_STATES,
);

/**
 * The guest may self-cancel. Deliberately narrower than the business set:
 * once the place is involved, walking away is the place's call.
 */
export const GUEST_CANCELLABLE_STATES: readonly TicketState[] = [
  "open",
  "scanned",
];
export const GUEST_CANCELLABLE_STATE_SET: ReadonlySet<string> = new Set(
  GUEST_CANCELLABLE_STATES,
);

/** The business console may cancel any live ticket. */
export const BUSINESS_CANCELLABLE_STATES: readonly TicketState[] = [
  "open",
  "scanned",
  "approved",
  "paying",
  "awaiting_payment_confirm",
];

/**
 * The single closed-with-honour terminal. Every metrics/performance/activity
 * reader counts exactly this — `cancelled` is terminal but never "closed".
 */
export const CLOSED_TICKET_STATE: TicketState = "revealed";

/**
 * The QR-farming dedupe set: consumer-web-create-ticket's friendly pre-check.
 * MUST stay equal to the predicate of the partial unique index
 * `tickets_one_open_check_per_consumer_place` (rebuilt over this exact set
 * by 20260817050100_ticket_v4_schema.sql) — the index is the guard that wins
 * races, the pre-check only makes the 409 friendly. Widen both in the same
 * PR or the one-live-ticket-per-place rule silently dies.
 */
export const CHECK_DEDUPE_STATES: readonly TicketState[] = [
  "open",
  "scanned",
  "approved",
  "paying",
  "awaiting_payment_confirm",
];
