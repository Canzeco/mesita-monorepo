import { PROMOTION_SCORE_MAX, promotionScore } from "@/lib/business/promotion-score";
import {
  CAPABILITY_WRITER_WORD,
  PLACE_CAPABILITIES,
} from "@/lib/state-vocabulary";

// Labels and detail copy come from the vocabulary, never from a literal in
// this file. That is the whole point of MESITA-1735: this module used to
// hand-type nine names while the rest of the console shared a generated
// list, so every rename landed here last, or not at all.
//
// The ladder row keys stay as they are — `byKey` in PromosSection indexes
// them and `accept_prepays` is the operator word for the `credits` column.
const CAP = Object.fromEntries(
  PLACE_CAPABILITIES.map((c) => [c.key, c]),
) as Record<
  (typeof PLACE_CAPABILITIES)[number]["key"],
  (typeof PLACE_CAPABILITIES)[number]
>;

// The Controls ladder — what a place offers, and what has to be true first.
//
// Pato live 2026-09-02: Controls is a DEPENDENCY LADDER, not a flat switch
// list. A place partners, then onboards Stripe, then can accept card payments,
// then can redeem prepaid balance, then can sell it. Every rung states its own
// prerequisite, because a greyed-out switch that does not say WHY is the defect
// this tab already had.
//
// TWO TIERS, ONE LADDER (MESITA-1867, Pato 2026-09-15). The partnership was
// one free switch, locked until Stripe was Ready — so the Stripe Connect
// onboarding (KYC, invoices) was the price of admission to REWARDS, which
// never needed a charge path. It is now two levels, and since MESITA-1892
// both of them are the PLACE's own, on its Products pages:
//
//   Mesita Partner   the place's YEARLY partnership (`places.partnered`).
//                    Unlocks Visit Rewards and Accept Prepays — arithmetic on
//                    the bill, no PSP.
//   Mesita Pay       an optional add-on ON TOP of Partner: the place's Stripe
//                    account (`place_payment_accounts`) and the
//                    `place_profiles.mesita_pay_enabled` switch. Unlocks this
//                    ladder's Mesita Pay rung and, through it, Sell Prepays.
//
// The rungs still gate on `member` — the PLACE's entitlement (`plan ≠ free`),
// which admin may grant independently. The two tier flags arrive as
// `placePartnered` / `placeMesitaPay` — they were `orgPartnered` / `orgMesitaPay`
// until MESITA-1892, and the prefix was the last thing left of a layer whose
// facts had already moved onto the place. They do two things only: the Pay rung reads
// the switch as a gate above Stripe, and the top line reads `placePartnered` to
// say WHICH door a non-member needs (subscribe, or re-join this place). Both
// are `null` when unknown, and unknown is "Checking…", never "off".
//
// THE TWO NAMES KEPT THEIR `org` PREFIX ON PURPOSE. They are the SETUP tier's
// facts as opposed to this ladder's own rungs, and `partnered` / `mesitaPay`
// on their own would read as the rung two lines below each of them. Renaming
// them to `setupPartnered` / `setupMesitaPay` is a clean follow-up; doing it
// inside the layer removal would put a rename nobody asked for in the middle
// of a diff that already touches every file here.
//
// TWO CORRECTIONS to the ladder as briefed, both auto-decided in the
// 2026-09-02 /autoplan run and recorded in its audit trail:
//
//   1. Redeeming a balance does NOT need the charge path. It is arithmetic on
//      the bill, exactly like today's discount — no PSP involved. So
//      `accept_prepays` gates on PARTNER, not on Mesita Pay. Only SELLING
//      balance needs a charge path, because that is money moving.
//   2. Prepays and cashback are ONE instrument on ONE ledger (place-scoped,
//      place-issued) with two funding paths — the guest buys, or the place
//      grants. See MESITA-1380. "Credits" stays the internal accounting unit
//      and never surfaces as a consumer balance; the operator-facing word is
//      Prepays. Wire keys do NOT follow the label: the column backing
//      `accept_prepays` is still `credits_enabled`.
//
// This module is PURE so it can be tested under vitest's node environment —
// web-admin has no jsdom, and `renderToStaticMarkup` never runs effects, so
// anything that matters has to be decidable without React.
//
// STRIPE IS THE PLACE'S STATE, READ HERE. `place_payment_accounts` is one row
// per PLACE (MESITA-1892; it was `organization_payment_accounts`, one row per
// organization, shared by every place it held — MESITA-1545). The merchant of
// record is the venue now, so "the place owns the account" is finally true;
// this ladder's `stripe` rung still only READS that state to gate what the
// place can do next. Onboarding lives on the place's `products/pay` page
// (PaymentsCard). A Connect form on THIS tab was a duplicate ask on a page
// about what guests can do (MESITA-1739), and it still would be.

/** What Stripe says about this place's connected account, reduced to the four
 *  states the ladder can act on. `none` also covers "payload predates the
 *  mirror" — absent is not the same as refused, but both mean not ready. */
export type ConnectState =
  | { kind: "none" }
  | { kind: "incomplete"; requirementsDue: string[] }
  | { kind: "ready" }
  | { kind: "disabled"; reason: string | null };

/**
 * Reduce the Connect mirror row to the state the ladder acts on.
 *
 * Order matters and is not obvious. Stripe stamps `disabled_reason:
 * "requirements.past_due"` on brand-new accounts that have never finished
 * onboarding, so reading disabled_reason FIRST would show "Stripe disabled
 * this account" to a place that simply has not started. `details_submitted`
 * is what separates "never finished" from "was live, then restricted".
 *
 * `orphaned` means the mirror points at an account the current Stripe key
 * cannot see (a rotated sandbox, or a livemode/testmode mismatch). Treated as
 * `none`: from the operator's side there is no usable account.
 */
export function connectStateFrom(
  account: {
    charges_enabled: boolean;
    details_submitted: boolean;
    requirements_due: string[];
    disabled_reason: string | null;
  } | null,
  orphaned = false,
): ConnectState {
  if (!account || orphaned) return { kind: "none" };
  if (!account.details_submitted) {
    return { kind: "incomplete", requirementsDue: account.requirements_due ?? [] };
  }
  if (account.disabled_reason) {
    return { kind: "disabled", reason: account.disabled_reason };
  }
  if (account.charges_enabled) return { kind: "ready" };
  return { kind: "incomplete", requirementsDue: account.requirements_due ?? [] };
}

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
  /** The read that decides this row has not answered yet. NEVER reduce a
   *  pending read to `locked` or `off`: `connectLoading` starts true while
   *  `connect` starts `{kind:"none"}`, so the Stripe rungs used to assert
   *  "Needs an active Stripe account" about a place that has one, for the
   *  length of a live Stripe round trip on every mount. */
  | { kind: "checking" }
  /** Real, but not the operator's to set — `writer` names who does. Never
   *  "Soon": a ship date is something an operator can neither act on nor
   *  verify, which is the same argument that makes `locked` outrank it. */
  | { kind: "not_mine"; word: string; on: boolean | null }
  | { kind: "off" }
  | { kind: "on" };

export type LadderBand = "money" | "service";

/** Operator asked for it, guests do not get it (or the reverse). Null when
 *  the two agree — those rows grow no extra line. */
export type RowDisagreement = {
  reason: string;
  fixLabel: string;
  /** `setup` = the place's Mesita Pay page (the subscription is a click away
   *  on Products, the Stripe account and the Mesita Pay switch are on it).
   *  `restore` = a Mesita review the operator cannot lift. `null` = the fix is
   *  another row on this page. */
  fix: "setup" | "restore" | null;
};

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
  disagreement: RowDisagreement | null;
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
    /** Observed by the Intaker, not declared by the operator, and null when
     *  the payload did not carry it. `false` here would be a claim nobody
     *  checked — see the reservations row. */
    reservations: boolean | null;
  };
  connect: ConnectState;
  /** The Connect mirror read is in flight. Independent of `connect`, which
   *  cannot distinguish "no account" from "not asked yet". */
  connectLoading?: boolean;
  /** Ghost-partner hold (MESITA-1311): Visit Rewards is on but guests get
   *  nothing until restore. */
  rewardLaneHeld?: boolean;
  /** This place's Mesita Partner subscription (`places.partnered`,
   *  MESITA-1867 / MESITA-1892). Read off the rail's own list, so
   *  `null`/undefined means the place is not in the viewer's list (or the
   *  payload predates the flag) — unknown, which only ever silences the top
   *  line. Never a gate on a rung: the place's own `member` is the
   *  entitlement fact. */
  placePartnered?: boolean | null;
  /** This place's Mesita Pay switch (`place_profiles.mesita_pay_enabled`).
   *  `false` locks the Mesita Pay rung ABOVE Stripe — the product is off, so
   *  the account's state is moot. `null`/undefined is "Checking…", never off:
   *  a stale payload must not tell a paying place its switch is down. */
  placeMesitaPay?: boolean | null;
  /** This place lost the partnership to a third strike (`plan_forfeited_at`).
   *  A forfeited place reads `member=false` (the strike patch drops `plan`),
   *  so without this the top line could not tell "never joined" from
   *  "forfeited" — and would send a forfeited place to subscribe again. */
  forfeited?: boolean;
};

const NEEDS_PARTNER = "Needs Mesita Partner";
const NEEDS_STRIPE = "Needs an active Stripe account";
const NEEDS_PAY = "Needs Mesita Pay";
// The product's own switch is off, one level up in Products. Not "Needs
// Mesita Pay in Products": the Reason chip is `w-[9.5rem] sm:w-[11rem]` and
// that overflows it, and the row's own label already says Mesita Pay — the
// chip only has to say where.
const NEEDS_ORG_PAY = "Off in Products";

function railState(on: boolean): RowState {
  return on ? { kind: "on" } : { kind: "off" };
}

/**
 * The ladder, in dependency order, as rows an operator reads top to bottom.
 *
 * ```
 *   Mesita Partner ─────────────────── the place's yearly partnership (Products)
 *        │
 *        ├── Visit Rewards ───────────── needs Mesita Partner
 *        ├── Accept Prepays ──────────── needs Mesita Partner (redeem ≠ charge)
 *        │
 *        ├── Mesita Pay in Products ──── the add-on switch (Products › Pay)
 *        │            │
 *        └── Stripe account ──────────── this place's, charge-ready (Products › Pay)
 *                     │                  (a SIBLING of the switch: `stripeState`
 *                     │                   never reads the switch — both feed the
 *                     │                   rung below)
 *                     └── Mesita Pay (rung) ── needs the Products switch on
 *                              │                AND an ACTIVE Stripe account
 *                              └── Sell Prepays ─── needs Mesita Pay
 *
 *   Pickup · Delivery · Reservations ── ungated, as today
 * ```
 */
export function offeringRows(input: LadderInput): OfferingRow[] {
  const { member, visitRewardsLevel, rails, connect } = input;
  const level = Math.min(2, Math.max(0, Math.trunc(visitRewardsLevel || 0)));
  // Checking outranks every verdict below it. The Connect mirror is read by a
  // client effect on every mount, so for the length of a live Stripe round
  // trip `connect` is `{kind:"none"}` — indistinguishable from a place that
  // never onboarded. Rendering `locked` there tells an operator with a working
  // Stripe account that they need one.
  const checking = input.connectLoading === true;

  const stripeState: RowState = !member
    ? { kind: "locked", needs: NEEDS_PARTNER }
    : checking
      ? { kind: "checking" }
      : connect.kind === "ready"
        ? { kind: "on" }
        : connect.kind === "disabled"
          ? { kind: "blocked", reason: connect.reason ?? "Stripe disabled this account." }
          : { kind: "off" };

  // Mesita Pay is the first rung where money actually moves, so it needs the
  // account to be CHARGE-READY, not merely present — and, above that, the
  // product's own switch in Products (MESITA-1867). Order: Partner, then that
  // switch (an explicit `false` is a verdict, and one that makes the Stripe
  // state moot), then the two reads still in flight (the Connect mirror, or a
  // tier flag the rail has not answered), then Stripe, then the rail.
  const payState: RowState = !member
    ? { kind: "locked", needs: NEEDS_PARTNER }
    : input.placeMesitaPay === false
      ? { kind: "locked", needs: NEEDS_ORG_PAY }
      : checking || input.placeMesitaPay == null
        ? { kind: "checking" }
        : connect.kind !== "ready"
          ? { kind: "locked", needs: NEEDS_STRIPE }
          : railState(rails.mesita_pay);

  const rows: Omit<OfferingRow, "disagreement">[] = [
    {
      key: "partnership",
      label: "Mesita Partner",
      detail: "This place's yearly partnership — the gate for everything below.",
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
          : "Where guest payments land. This place owns the account and the Stripe dashboard.",
      band: "money",
      state: stripeState,
      points: null,
      earned: false,
    },
    {
      key: "mesita_pay",
      label: CAP.mesita_pay.label,
      detail: CAP.mesita_pay.detail,
      band: "money",
      state: payState,
      points: 1,
      earned: rails.mesita_pay,
    },
    {
      key: "visit_rewards",
      label: CAP.visit_rewards.label,
      detail: CAP.visit_rewards.detail,
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
      label: CAP.credits.label,
      // Load-bearing sentence: redemption is a bill reduction, so no money is
      // held and no PSP is involved. It is why this rung does not need Stripe.
      detail: CAP.credits.detail,
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
      label: CAP.pickup.label,
      detail: CAP.pickup.detail,
      band: "service",
      state: railState(rails.pickup),
      points: 1,
      earned: rails.pickup,
    },
    {
      key: "delivery",
      label: CAP.delivery.label,
      detail: CAP.delivery.detail,
      band: "service",
      state: railState(rails.delivery),
      points: 1,
      earned: rails.delivery,
    },
    {
      key: "reservations",
      label: CAP.reservations.label,
      detail: CAP.reservations.detail,
      band: "service",
      // THE ROW USED TO BE A CONSTANT. `state: { kind: "off" }` was hard-coded
      // while `web-consumer`'s `isReserveActionEnabled` read
      // `place_profiles.reservations_enabled` and rendered a live Reserve CTA
      // off the same column — so the console told an operator they take no
      // bookings while their guests were making them (MESITA-1735).
      //
      // NO SWITCH HERE, but the operator does own the fact (MESITA-1737).
      // The control is the ReservationsCard's ChannelPicker further down this
      // page — pick a channel and `reservations_enabled` follows it, pick
      // "Not" and it goes false. The Intaker's `reservationsLikely` is only a
      // SEED now, and only survives while no channel has been picked; a
      // trigger on `place_profiles` states the fact once so a contents re-run
      // can no longer overwrite an answer. A switch here would still return
      // 200 and write nothing: the set-place-rails doors' RAIL_COLUMNS has no
      // key for it, and two controls for one fact is what this row is for
      // avoiding.
      //
      // The `Observed` word is therefore right only until someone picks a
      // channel, and MESITA-1739 is where the row learns to say which.
      //
      // null ⇒ the payload did not carry it. `false` would be a claim nobody
      // checked, on the one row that already shipped exactly that bug.
      state: {
        kind: "not_mine",
        word: CAPABILITY_WRITER_WORD[CAP.reservations.writer],
        on: rails.reservations,
      },
      points: null,
      earned: false,
    },
  ];
  return rows.map((row) => ({ ...row, disagreement: disagreementOf(row, input) }));
}

/** Guest-facing phrase for the summary line. Partnership and Stripe are
 *  not things a guest does; Sell Prepays has no engine. */
const GUEST_PHRASE: Partial<Record<LadderRowKey, string>> = {
  reservations: "book a table",
  pickup: "order pickup",
  delivery: "order delivery",
  mesita_pay: "pay by card",
  visit_rewards: "earn visit rewards",
  accept_prepays: "redeem prepays",
};

function operatorAsked(row: Omit<OfferingRow, "disagreement">, input: LadderInput): boolean {
  switch (row.key) {
    case "partnership":
      return input.member;
    case "stripe":
      return input.connect.kind !== "none";
    case "mesita_pay":
      return input.rails.mesita_pay;
    case "visit_rewards":
      return input.visitRewardsLevel > 0;
    case "accept_prepays":
      return input.rails.credits;
    case "sell_prepays":
      return false;
    case "pickup":
      return input.rails.pickup;
    case "delivery":
      return input.rails.delivery;
    case "reservations":
      return input.rails.reservations === true;
  }
}

function guestsGet(row: Omit<OfferingRow, "disagreement">, input: LadderInput): boolean {
  if (row.state.kind === "checking") return false;
  switch (row.key) {
    case "partnership":
    case "stripe":
    case "sell_prepays":
      return false;
    case "visit_rewards":
      return input.member && input.visitRewardsLevel > 0 && !input.rewardLaneHeld;
    case "mesita_pay":
      return row.state.kind === "on";
    case "reservations":
      return row.state.kind === "not_mine" && row.state.on === true;
    default:
      return row.state.kind === "on";
  }
}

function disagreementOf(
  row: Omit<OfferingRow, "disagreement">,
  input: LadderInput,
): RowDisagreement | null {
  if (row.state.kind === "checking") return null;
  const asked = operatorAsked(row, input);
  const live = guestsGet(row, input);
  if (asked === live) return null;
  if (asked && !live) {
    if (row.key === "visit_rewards" && input.rewardLaneHeld) {
      return {
        reason: "Visit Rewards is on, but a guest report is holding the lane.",
        fixLabel: "Restore",
        fix: "restore",
      };
    }
    if (row.state.kind === "locked") {
      // All three setup-tier prerequisites are fixed on the place's Mesita Pay
      // page: the Stripe account and the Mesita Pay switch are ON it, and the
      // subscription is the banner one click up on Products.
      const inSetup =
        row.state.needs === NEEDS_PARTNER ||
        row.state.needs === NEEDS_STRIPE ||
        row.state.needs === NEEDS_ORG_PAY;
      return {
        reason: `You asked for ${row.label}, but guests do not get it yet — ${row.state.needs.toLowerCase()}.`,
        fixLabel: "Mesita Pay",
        fix: inSetup ? "setup" : null,
      };
    }
    if (row.state.kind === "blocked") {
      return {
        reason: `You asked for ${row.label}, but Stripe turned it off.`,
        fixLabel: "Mesita Pay",
        fix: "setup",
      };
    }
    return {
      reason: `You asked for ${row.label}, but guests do not get it yet.`,
      fixLabel: "",
      fix: null,
    };
  }
  // Guests get it; the console does not show it as on. The 1735 class of bug.
  return {
    reason: `Guests can already use ${row.label.toLowerCase()}, but this row does not show it on.`,
    fixLabel: "",
    fix: null,
  };
}

/** One sentence for first paint. Empty live set is the real empty state. */
export function guestSummary(rows: readonly OfferingRow[]): string {
  const phrases = rows
    .filter((r) => {
      if (!GUEST_PHRASE[r.key]) return false;
      if (r.disagreement) return false;
      if (r.key === "reservations") return r.state.kind === "not_mine" && r.state.on === true;
      return r.state.kind === "on";
    })
    .map((r) => GUEST_PHRASE[r.key]!);
  if (phrases.length === 0) return "Right now, nothing is live for guests.";
  if (phrases.length === 1) {
    return `Right now, guests can ${phrases[0]}. Nothing else is live.`;
  }
  if (phrases.length === 2) {
    return `Right now, guests can ${phrases[0]} and ${phrases[1]}.`;
  }
  const last = phrases[phrases.length - 1];
  return `Right now, guests can ${phrases.slice(0, -1).join(", ")}, and ${last}.`;
}

// ── THE TWO ZONES (MESITA-1841) ───────────────────────────────────────────
//
// The ladder is one computation and stays one: the rungs depend on each other,
// so splitting the ENGINE would mean computing Partner and Stripe twice and
// letting the two copies disagree. What splits is the DISPLAY. Pato's drawing
// of 2026-09-14 gives the place five views, two of which come out of this one
// component:
//
//   Capabilities   what a guest CAN do here — pay by card, redeem prepays,
//                  order pickup or delivery, book a table — plus the internal
//                  "How this place is run" zone.
//   Rewards        what a guest EARNS here: Visit Rewards, its strategy
//                  ladder, and the Partnership body that prices them.
//
// The line is not new. `PromosSection` already drew it with its own headings;
// this makes it an address, so a link can point at one or the other.
//
// EVERY GUEST ROW BELONGS TO EXACTLY ONE ZONE, and `offerings.test.ts` proves
// it — a row added to the ladder and to neither zone would silently render
// nowhere, which is the one failure mode this split can have.

// ── A ZONE IS A PRODUCT NOW (MESITA-1885) ─────────────────────────────────
//
// The zones were `capabilities` and `rewards`, one page each. Pato put all
// eight products in the rail, and three of them — Orders, Reservations and
// Credits — were rows INSIDE Capabilities, so three rail rows would have
// opened one address and highlighted together. The rooms had to match the
// list.
//
// NO ROW MOVED BETWEEN PRODUCTS and none was invented: the six Capabilities
// rows redistribute to the four products that own them, and `visit_rewards`
// stays under the product it was always a dial inside (MESITA-1884). The test
// still proves EVERY guest row belongs to exactly one zone, which is the one
// failure mode this split can have.
//
// `mesita_pay` is the RUNG an operator flips day to day; the switch that
// unlocks it and the Stripe account behind that live at
// `/places/<id>/products/pay`, and the Pay view links up to them. Two screens,
// one product: buying it, and running it. The split was organization-versus-
// place until MESITA-1892 and is setup-versus-use now, which is the same split
// every other card on the catalogue draws.
export const LADDER_ZONES = [
  "visits",
  "orders",
  "reservations",
  "pay",
  "credits",
] as const;
export type LadderZone = (typeof LADDER_ZONES)[number];

export const ZONE_ROWS: Record<LadderZone, readonly LadderRowKey[]> = {
  visits: ["visit_rewards"],
  orders: ["pickup", "delivery"],
  reservations: ["reservations"],
  pay: ["mesita_pay"],
  credits: ["accept_prepays", "sell_prepays"],
};

/** The zone's rows, in the ladder's own order. Partnership and Stripe belong
 *  to no zone: they are prerequisites, rendered as the one-line prompt and the
 *  Partnership body, never as switches. */
export function rowsForZone(
  rows: readonly OfferingRow[],
  zone: LadderZone,
): OfferingRow[] {
  const keep = ZONE_ROWS[zone];
  return rows.filter((r) => keep.includes(r.key));
}

/** Partnership and Stripe are not guest capabilities — they leave this list
 *  (chip / Org / one line). Disagreements sort first; then writable; then
 *  "Not yours to set". */
export function paintRows(rows: readonly OfferingRow[]): OfferingRow[] {
  const guest = rows.filter((r) => r.key !== "partnership" && r.key !== "stripe");
  const rank = (r: OfferingRow) => {
    if (r.disagreement) return 0;
    if (r.state.kind === "not_mine" || r.state.kind === "soon") return 2;
    return 1;
  };
  return [...guest].sort((a, b) => rank(a) - rank(b));
}

export type TopPrerequisite =
  /** The fix is on the place's own setup page — the line carries a link. */
  | { action: "setup"; text: string }
  /** The fix is THIS place's own re-join, never the setup page — no link. The
   *  door is not built yet, so the line says when it lands instead of
   *  pointing anywhere: this engine renders on five zones, and only Visits
   *  carries the partnership box, so "below" would point at nothing on the
   *  other four. */
  | { action: "rejoin"; text: string };

/**
 * The one prerequisite that unlocks the most rows. One line, not a card.
 *
 * TWO "PARTNER" FACTS, ONE PRECEDENCE (MESITA-1867). `member` is the place's
 * entitlement (`plan ≠ free`) and is what every rung gates on; `placePartnered`
 * — `places.partnered`, the subscription — only decides which DOOR a
 * non-member is sent to. The cells, each pinned in offerings.test.ts:
 *
 *   member                                → silent, whatever the tier says
 *                                           (except Stripe, below)
 *   !member ∧ placePartnered = false        → subscribe in Products (link)
 *   !member ∧ placePartnered = true ∧ forfeited → re-join this place (unbuilt;
 *                                           the line says when it lands)
 *   !member ∧ placePartnered = true ∧ !forfeited → same door (a dropped place
 *                                           whose subscription is still live)
 *   !member ∧ placePartnered unknown        → nothing — the rail has not
 *                                           answered, and a wrong door is
 *                                           worse than no line
 *
 * The re-join lines used to end "— re-join it below." That promised a button
 * that was inert on one zone and absent on the others (the same engine paints
 * them all), so they now carry the one sentence every unbuilt door on this
 * console uses. The Visits box adds what re-joining will do and whose action
 * it is; this line never says "below".
 *
 * The Stripe line is Mesita Pay's concern, so it only shows once the Mesita
 * Pay switch is known ON: with it off (or unknown) the rung already says "Off
 * in Products" / "Checking…", and a page that nags a Partner-only place to
 * connect Stripe would be re-selling the add-on.
 */
/** An OPTIONAL payload flag, read as the ladder wants it: absent is
 *  unknown (null → "Checking…"), never off. */
export function tierFlag(v: boolean | null | undefined): boolean | null {
  return v == null ? null : v;
}

export function topPrerequisite(input: LadderInput): TopPrerequisite | null {
  if (!input.member) {
    if (input.placePartnered === false) {
      return {
        action: "setup",
        // No "here": this line paints on every zone, and Visit Rewards lives
        // on Visits while Accept Prepays lives on Credits.
        text: "Become a Mesita Partner in Products — it unlocks Visit Rewards and Accept Prepays.",
      };
    }
    if (input.placePartnered === true) {
      return {
        action: "rejoin",
        text: input.forfeited
          ? "This place forfeited the partnership after 3 strikes — re-join lands with the next release."
          : "This place is not in the partnership — re-join lands with the next release.",
      };
    }
    return null;
  }
  if (input.placeMesitaPay !== true) return null;
  if (input.connectLoading) return null;
  if (input.connect.kind !== "ready") {
    return {
      action: "setup",
      text: "Connect Stripe in Products so guests can pay by card here.",
    };
  }
  return null;
}

/** Sum of what the rows say they are worth. MUST equal `promotionScore` for
 *  the same input — the header meter used to show this, and
 *  `ladderScoreMatchesPromotionScore` still proves the numbers agree. */
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
  return controlWriteFailure(`turn ${label} ${next ? "on" : "off"}`);
}

/**
 * The same sentence shape for every other Controls write (MESITA-1419).
 *
 * `railWriteFailure` had the rule right and was the only caller obeying it:
 * every other write on this tab piped `r.error` — the Edge Function's own
 * words — straight into `LadderRow`'s error slot, whose doc comment says
 * "Never a raw Edge Function string". A server sentence is written for a log.
 * `action` is an infinitive phrase: "join the partnership", "switch strategy".
 */
export function controlWriteFailure(action: string): string {
  return `Couldn't ${action}. Nothing changed — try again.`;
}

/** EF failure codes this tab BRANCHES on rather than prints. */
export const STRIPE_LIVE_BLOCKED = "stripe_live_blocked";

/**
 * What a refused Connect onboarding says to the operator.
 *
 * `liveChargesBlocked` (MESITA-37) answers with a runbook line — it names
 * STRIPE_SECRET_KEY, STRIPE_ALLOW_LIVE and the value to set. That is the right
 * message for whoever runs the deploy and the wrong one for the console: an
 * operator cannot export a Deno env var, so the row says what is true of THIS
 * place and who can change it. The env names stay in `console.error`.
 *
 * It is also not a retry. The block is a property of the environment, not of
 * the attempt, so the copy says so and the caller stops offering the button.
 */
export function connectStartFailure(
  code: string | null,
  message?: string | null,
): string {
  if (code === STRIPE_LIVE_BLOCKED) {
    return "Stripe onboarding is off: Mesita is on live keys with real charges disabled, so connecting would open a live account. Flipping that is a human step (MESITA-37) \u2014 retrying won't change it.";
  }
  // `place_has_no_organization` WAS HANDLED HERE (MESITA-1563): the EF
  // resolved the organization from the placeId and refused when the place was
  // in the pool. There is no organization to resolve (MESITA-1892), so the EF
  // cannot answer that code and the branch is gone rather than kept as a dead
  // string match.
  // Stripe named the problem; say what it said. Everything this endpoint can
  // fail on is configuration ("you can only create new accounts if you've
  // signed up for Connect", "this looks like the ID of an API key"), so a
  // generic "try again" is both useless and false.
  if (code === "stripe_error" && message) return `Stripe: ${message}`;
  return controlWriteFailure("start Stripe onboarding");
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
