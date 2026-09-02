import { PROMOTION_SCORE_MAX, promotionScore } from "@/lib/business/promotion-score";

// The Controls ladder — what a place offers, and what has to be true first.
//
// Pato live 2026-09-02: Controls is a DEPENDENCY LADDER, not a flat switch
// list. A place partners, then onboards Stripe, then can accept card payments,
// then can redeem prepaid balance, then can sell it. Every rung states its own
// prerequisite, because a greyed-out switch that does not say WHY is the defect
// this tab already had.
//
// TWO CORRECTIONS to the ladder as briefed, both auto-decided in the
// 2026-09-02 /autoplan run and recorded in its audit trail:
//
//   1. Redeeming a balance does NOT need the charge path. It is arithmetic on
//      the bill, exactly like today's discount — no PSP involved. So
//      `accept_prepays` gates on PARTNER, not on Mesita Pay. Only SELLING
//      balance needs a charge path, because that is money moving.
//   2. Prepays and cashback are ONE instrument on ONE ledger (venue-scoped,
//      place-issued) with two funding paths — the guest buys, or the place
//      grants. See MESITA-1380. "Credits" stays the internal accounting unit
//      and never surfaces as a consumer balance; the operator-facing word is
//      Prepays. Wire keys do NOT follow the label: the column backing
//      `accept_prepays` is still `credits_enabled`.
//
// This module is PURE so it can be tested under vitest's node environment —
// web-admin has no jsdom, and `renderToStaticMarkup` never runs effects, so
// anything that matters has to be decidable without React.

/** What Stripe says about this place's connected account, reduced to the
 *  four states the ladder can act on. `none` also covers "payload predates
 *  the mirror" — absent is not the same as refused, but both mean not ready. */
export type ConnectState =
  | { kind: "none" }
  | { kind: "incomplete"; requirementsDue: string[] }
  | { kind: "ready" }
  | { kind: "disabled"; reason: string | null };

export type LadderRowKey =
  | "partnership"
  | "stripe"
  | "mesita_pay"
  | "visit_rewards"
  | "accept_prepays"
  | "sell_prepays"
  | "pickup"
  | "delivery"
  | "reservations";

/** A row is never merely "disabled" — every non-actionable state carries the
 *  sentence an operator needs to act on it. */
export type RowState =
  /** Prerequisite unmet. `needs` names it, in operator words. */
  | { kind: "locked"; needs: string }
  /** Stripe turned it off after it was on. `reason` is Stripe's own. */
  | { kind: "blocked"; reason: string }
  /** No engine yet. Honest, and not a knob pretending to work. */
  | { kind: "soon" }
  | { kind: "off" }
  | { kind: "on" };

export type LadderBand = "money" | "service";

export type OfferingRow = {
  key: LadderRowKey;
  label: string;
  detail: string;
  band: LadderBand;
  state: RowState;
  /** Points this row contributes RIGHT NOW. null = it can never score, which
   *  renders as an em dash (`promotionScore` counts six things, not nine). */
  points: number | null;
  /** True when `points` is a positive contribution today. */
  earned: boolean;
};

export type LadderInput = {
  member: boolean;
  /** Operator ladder 0 | 1 | 2 (Dominant clamps to 2). */
  visitRewardsLevel: number;
  rails: {
    mesita_pay: boolean;
    credits: boolean;
    pickup: boolean;
    delivery: boolean;
  };
  connect: ConnectState;
};

const NEEDS_PARTNER = "Needs the partnership";
const NEEDS_STRIPE = "Needs an active Stripe account";
const NEEDS_PAY = "Needs Mesita Pay";

function railState(on: boolean): RowState {
  return on ? { kind: "on" } : { kind: "off" };
}

/**
 * The ladder, in dependency order, as rows an operator reads top to bottom.
 *
 * ```
 *   Mesita Partnership ─────────────── (no prerequisite)
 *        │
 *        ├── Mesita Stripe Account ──── needs partnership
 *        │        │
 *        │        └── Mesita Pay ─────── needs an ACTIVE Stripe account
 *        │                 │
 *        │                 └── Sell Prepays ─── needs Mesita Pay
 *        ├── Visit Rewards ───────────── needs partnership
 *        └── Accept Prepays ──────────── needs partnership (redeem ≠ charge)
 *
 *   Pickup · Delivery · Reservations ── ungated, as today
 * ```
 */
export function offeringRows(input: LadderInput): OfferingRow[] {
  const { member, visitRewardsLevel, rails, connect } = input;
  const level = Math.min(2, Math.max(0, Math.trunc(visitRewardsLevel || 0)));

  const stripeState: RowState = !member
    ? { kind: "locked", needs: NEEDS_PARTNER }
    : connect.kind === "ready"
      ? { kind: "on" }
      : connect.kind === "disabled"
        ? { kind: "blocked", reason: connect.reason ?? "Stripe disabled this account." }
        : { kind: "off" };

  // Mesita Pay is the first rung where money actually moves, so it needs the
  // account to be CHARGE-READY, not merely present.
  const payState: RowState = !member
    ? { kind: "locked", needs: NEEDS_PARTNER }
    : connect.kind !== "ready"
      ? { kind: "locked", needs: NEEDS_STRIPE }
      : railState(rails.mesita_pay);

  return [
    {
      key: "partnership",
      label: "Mesita Partnership",
      detail: "MX$1,000 per month — the first step, and the gate for everything below.",
      band: "money",
      state: member ? { kind: "on" } : { kind: "off" },
      points: 1,
      earned: member,
    },
    {
      key: "stripe",
      label: "Mesita Stripe Account",
      detail:
        connect.kind === "incomplete" && connect.requirementsDue.length > 0
          ? `Stripe still needs ${connect.requirementsDue.length} detail${connect.requirementsDue.length === 1 ? "" : "s"} before this place can be paid.`
          : "Where guest payments land. The place owns the account and the Stripe dashboard.",
      band: "money",
      state: stripeState,
      points: null,
      earned: false,
    },
    {
      key: "mesita_pay",
      label: "Mesita Pay",
      detail: "Guests pay the bill by card, inside Mesita.",
      band: "money",
      state: payState,
      points: 1,
      earned: rails.mesita_pay,
    },
    {
      key: "visit_rewards",
      label: "Visit Rewards",
      detail: "What a visit pays back — Zero, Conservative or Aggressive.",
      band: "money",
      state: !member
        ? { kind: "locked", needs: NEEDS_PARTNER }
        : level > 0
          ? { kind: "on" }
          : { kind: "off" },
      points: level,
      earned: level > 0,
    },
    {
      key: "accept_prepays",
      label: "Accept Prepays",
      // Load-bearing sentence: redemption is a bill reduction, so no money is
      // held and no PSP is involved. It is why this rung does not need Stripe.
      detail: "Redeem a guest's prepaid balance as a bill discount, never a payment.",
      band: "money",
      state: !member
        ? { kind: "locked", needs: NEEDS_PARTNER }
        : railState(rails.credits),
      points: 1,
      earned: rails.credits,
    },
    {
      key: "sell_prepays",
      label: "Sell Prepays",
      detail: "Guests buy balance for this place, up front. The place issues it and holds it.",
      band: "money",
      // Gated on Mesita Pay because selling IS money moving; and parked
      // regardless until the ledger exists. Locked outranks Soon: a prerequisite
      // an operator can act on beats a ship date they cannot.
      state:
        payState.kind !== "on"
          ? { kind: "locked", needs: NEEDS_PAY }
          : { kind: "soon" },
      points: null,
      earned: false,
    },
    {
      key: "pickup",
      label: "Pickup Orders",
      detail: "Guests order ahead and pick up.",
      band: "service",
      state: railState(rails.pickup),
      points: 1,
      earned: rails.pickup,
    },
    {
      key: "delivery",
      label: "Delivery Orders",
      detail: "Guests order for delivery.",
      band: "service",
      state: railState(rails.delivery),
      points: 1,
      earned: rails.delivery,
    },
    {
      key: "reservations",
      label: "Reservations",
      detail: "How a guest books, or that they don't.",
      band: "service",
      state: { kind: "off" },
      points: null,
      earned: false,
    },
  ];
}

/** Sum of what the rows say they are worth. MUST equal `promotionScore` for
 *  the same input — the header meter and the points column are one claim, and
 *  `ladderScoreMatchesPromotionScore` proves it rather than trusting it. */
export function ladderScore(rows: readonly OfferingRow[]): number {
  return rows.reduce((n, r) => n + (r.earned && r.points ? r.points : 0), 0);
}

export function ladderScoreMatchesPromotionScore(input: LadderInput): boolean {
  return (
    ladderScore(offeringRows(input)) ===
    promotionScore({
      partner: input.member,
      visitRewardsLevel: input.visitRewardsLevel,
      mesitaPay: input.rails.mesita_pay,
      credits: input.rails.credits,
      pickup: input.rails.pickup,
      delivery: input.rails.delivery,
    })
  );
}

export { PROMOTION_SCORE_MAX };

/**
 * What a failed rail write says to the operator, verbatim (MESITA-1399 #2).
 *
 * The switch has already reverted by the time this renders, so the copy states
 * the outcome rather than the attempt. The raw Edge Function error NEVER
 * reaches the DOM — it goes to `console.error`, because an operator cannot act
 * on a Postgres constraint name and an engineer can read the console.
 */
export function railWriteFailure(label: string, next: boolean): string {
  return `Couldn't turn ${label} ${next ? "on" : "off"}. Nothing changed — try again.`;
}

/**
 * Whether a nested config block renders.
 *
 * CRITICAL, and the reason this is a named function rather than an inline
 * `&&`: `useSectionDirty` cleans up on unmount (`registerSaver(section, null)`
 * plus `setSectionDirty(section, false)`), so conditionally UNMOUNTING a config
 * silently discards its pending edit AND stops the unsaved-changes guard
 * counting it. No warning, and web-admin has no analytics to catch it.
 *
 * So the config always stays mounted and is hidden with CSS — and it stays
 * VISIBLE whenever it is dirty, even with its switch off, so an operator can
 * never hold an unsaved edit they cannot see. That second clause is also what
 * keeps `saveAll` honest: an invalid draft blocks the whole page save, and
 * `getPatch` only returns `{kind:"invalid"}` when dirty, so the row that
 * blocked the save is always on screen.
 */
export function shouldRenderConfig(enabled: boolean, dirty: boolean): boolean {
  return enabled || dirty;
}
