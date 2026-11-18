// The checkout state machine. Pure: no React, no timers, no randomness.
// Every money rule lives here, not in the UI.
import { type Offer, type VoucherId, VOUCHERS, selectOffer } from "./offer";
import { parseAmount, pct } from "./money";
import { copy } from "./copy";

export const PLACE = { name: "Taquería Orinoco", distance: "20 m", code: "482913" } as const;
export const FEE_PERCENT_VOUCHERS = 5;
export const FEE_PERCENT_TIPS = 0;
export const BONUS_DELAY_HOURS = 3;

export type Step =
  | "pick"
  | "bill"
  | "tip"
  | "upsell"
  | "method"
  | "cashPay"
  | "sign"
  | "cardPay"
  | "receipt"
  | "notPaid";

/** Pato's eight steps (0–8) plus the one failure screen. */
export const STEP_LABEL: Record<Step, string> = {
  pick: "0 · Pick",
  bill: "1 · Bill",
  tip: "2 · Tip",
  upsell: "3 · Upsell",
  method: "4 · Method",
  cashPay: "5 · Cash pay",
  sign: "6 · Sign",
  cardPay: "7 · Card pay",
  receipt: "8 · Receipt",
  notPaid: "Not paid",
};

export type TipKind = "none" | "10" | "15" | "other";
export type Method = "card" | "cash";
export type Upsell = "none" | "offered" | "accepted" | "skipped";
export type NotPaidReason = "rejected" | "cancelled" | "timeout";

export interface PlaceSettings {
  checkoutOn: boolean;
  upsellOn: boolean;
  checked: Record<VoucherId, boolean>;
}

export interface Scenario {
  credit: number;
  billPrefill: number;
  newGuest: boolean;
  cardResult: "approved" | "declined";
  vouchersModule: boolean;
  stripeCards: boolean;
  fastTimer: boolean;
}

export interface PendingBonus {
  voucher: string;
  amount: number;
  billId: number;
}

export interface Wallet {
  /** Credit ready to spend at the place. */
  credit: number;
  /** Credit held by an open Sign step; not spendable, not yet deducted. */
  reserved: number;
  pending: PendingBonus[];
  welcomeUsed: boolean;
}

export interface Payment {
  kind: Method;
  amount: number;
}

export interface Receipt {
  bill: number;
  creditUsed: number;
  voucher: { label: string; price: number; now: number; bonus: number } | null;
  paidByCard: number;
  paidAtTable: number;
  tip: number;
  tipHow: Method | null;
  creditLeft: number;
  pendingBonus: number;
}

export interface BillRecord {
  id: number;
  outcome: "paid" | NotPaidReason;
  amount: number;
  payment: Payment | null;
  voucherPrice: number;
  tip: number;
}

export interface History {
  vouchersSold: number;
  moneyIn: number;
  bonusOwed: number;
  tipsByCard: number;
  bills: BillRecord[];
}

export interface Bill {
  id: number;
  step: Step;
  /** Frozen when the bill opens: console changes apply to the next bill. */
  settings: PlaceSettings;
  amountText: string;
  amountError: string | null;
  useCredit: boolean;
  tipKind: TipKind;
  tipOther: string;
  tipError: string | null;
  upsell: Upsell;
  offer: Offer | null;
  method: Method | null;
  methodError: string | null;
  /** Card hold placed at Method; captured at Card pay. */
  hold: number | null;
  deadline: number | null;
  scanned: boolean;
  cashChecked: boolean;
  code: string;
  waiterError: string | null;
  verified: boolean;
  notPaidReason: NotPaidReason | null;
  payments: Payment[];
  receipt: Receipt | null;
}

export interface State {
  scenario: Scenario;
  place: PlaceSettings;
  wallet: Wallet;
  history: History;
  bill: Bill;
}

export type Event =
  | { type: "START" }
  | { type: "SET_AMOUNT"; text: string }
  | { type: "TOGGLE_CREDIT" }
  | { type: "BILL_NEXT" }
  | { type: "SET_TIP"; kind: TipKind }
  | { type: "SET_TIP_OTHER"; text: string }
  | { type: "TIP_NEXT" }
  | { type: "UPSELL_BUY" }
  | { type: "UPSELL_SKIP" }
  | { type: "CHOOSE_METHOD"; method: Method }
  | { type: "METHOD_NEXT" }
  | { type: "DROP_VOUCHER" }
  | { type: "CASH_PAID" }
  | { type: "BACK" }
  | { type: "CANCEL" }
  | { type: "TIMEOUT" }
  | { type: "WAITER_SCAN" }
  | { type: "WAITER_CASH_CHECK"; checked: boolean }
  | { type: "WAITER_CODE"; text: string }
  | { type: "WAITER_VERIFY" }
  | { type: "WAITER_REJECT" }
  | { type: "CAPTURE" }
  | { type: "START_AGAIN" }
  | { type: "DONE" }
  | { type: "SET_PLACE"; place: PlaceSettings }
  | { type: "RESTART"; scenario: Scenario };

export const DEFAULT_SCENARIO: Scenario = {
  credit: 300,
  billPrefill: 730,
  newGuest: false,
  cardResult: "approved",
  vouchersModule: true,
  stripeCards: true,
  fastTimer: false,
};

export const DEFAULT_PLACE: PlaceSettings = {
  checkoutOn: true,
  upsellOn: true,
  checked: { small: true, medium: true, big: true, welcome: true },
};

const EMPTY_HISTORY: History = { vouchersSold: 0, moneyIn: 0, bonusOwed: 0, tipsByCard: 0, bills: [] };

// ---------- derived values ----------

/** Why upselling cannot run, or null when its requirements are met. */
export function upsellBlocker(scenario: Scenario): string | null {
  if (!scenario.vouchersModule) return copy.console.blockedVouchers;
  if (!scenario.stripeCards) return copy.console.blockedStripe;
  return null;
}

export function upsellingOn(settings: PlaceSettings, scenario: Scenario): boolean {
  return settings.upsellOn && upsellBlocker(scenario) === null;
}

export function signDurationMs(scenario: Scenario): number {
  return scenario.fastTimer ? 10_000 : 10 * 60_000;
}

export interface Quote {
  amount: number;
  /** Existing credit applied to the bill (never to the tip). */
  creditApplied: number;
  /** Bill minus credit applied. */
  shortfall: number;
  tip: number;
  /** Voucher credit spent on this bill when the upsell was bought. */
  voucherCreditApplied: number;
  /** What the one payment of this bill must be (0 = nothing to pay). */
  due: number;
  /** Food covered by credit, existing plus voucher. */
  totalCredit: number;
}

export function tipAmount(bill: Bill): number {
  const amount = parseAmount(bill.amountText);
  switch (bill.tipKind) {
    case "none":
      return 0;
    case "10":
      return pct(amount, 10);
    case "15":
      return pct(amount, 15);
    case "other":
      return parseAmount(bill.tipOther);
  }
}

export function quote(state: State): Quote {
  const { bill, wallet } = state;
  const amount = parseAmount(bill.amountText);
  const spendable = Math.max(0, wallet.credit - wallet.reserved);
  // During Sign the credit is reserved for this very bill, so count it back.
  const available = bill.step === "sign" || bill.step === "cardPay" ? wallet.credit : spendable;
  const creditApplied = bill.useCredit ? Math.min(available, amount) : 0;
  const shortfall = amount - creditApplied;
  const tip = tipAmount(bill);
  const bought = bill.upsell === "accepted" && bill.offer !== null;
  const voucherCreditApplied = bought ? shortfall : 0;
  const due = bought ? bill.offer!.charge : shortfall + tip;
  return { amount, creditApplied, shortfall, tip, voucherCreditApplied, due, totalCredit: creditApplied + voucherCreditApplied };
}

export function offerFor(state: State): Offer | null {
  const q = quote(state);
  const { settings } = state.bill;
  return selectOffer({
    shortfall: q.shortfall,
    tip: q.tip,
    newGuest: state.scenario.newGuest && !state.wallet.welcomeUsed,
    checked: VOUCHERS.filter((v) => settings.checked[v.id]),
    upsellingOn: upsellingOn(settings, state.scenario),
  });
}

export function cardAvailable(state: State): boolean {
  return state.scenario.stripeCards;
}

/** Cash is never available for a voucher, which is always bought by card. */
export function cashAvailable(state: State): boolean {
  return state.bill.upsell !== "accepted";
}

// ---------- construction ----------

function newBill(id: number, place: PlaceSettings, scenario: Scenario): Bill {
  return {
    id,
    step: "pick",
    settings: structuredClone(place),
    amountText: scenario.billPrefill > 0 ? String(scenario.billPrefill) : "",
    amountError: null,
    useCredit: true,
    tipKind: "10",
    tipOther: "",
    tipError: null,
    upsell: "none",
    offer: null,
    method: null,
    methodError: null,
    hold: null,
    deadline: null,
    scanned: false,
    cashChecked: false,
    code: "",
    waiterError: null,
    verified: false,
    notPaidReason: null,
    payments: [],
    receipt: null,
  };
}

export function initialState(
  scenario: Scenario = DEFAULT_SCENARIO,
  place: PlaceSettings = DEFAULT_PLACE,
  history: History = EMPTY_HISTORY,
): State {
  return {
    scenario,
    place: structuredClone(place),
    wallet: { credit: scenario.credit, reserved: 0, pending: [], welcomeUsed: false },
    history: structuredClone(history),
    bill: newBill(history.bills.length + 1, place, scenario),
  };
}

// ---------- transitions ----------

function withBill(state: State, patch: Partial<Bill>): State {
  return { ...state, bill: { ...state.bill, ...patch } };
}

/** Sign: reserve the credit (do not deduct it) and start the countdown. */
function enterSign(state: State, now: number): State {
  const q = quote(state);
  return {
    ...state,
    wallet: { ...state.wallet, reserved: q.creditApplied },
    bill: {
      ...state.bill,
      step: "sign",
      deadline: now + signDurationMs(state.scenario),
      scanned: false,
      cashChecked: false,
      code: "",
      waiterError: null,
      verified: false,
    },
  };
}

/** After Tip or Upsell: Method when something is due, else straight to Sign. */
function toMethodOrSign(state: State, now: number): State {
  if (quote(state).due === 0) return enterSign(withBill(state, { method: null }), now);
  return withBill(state, { step: "method", methodError: null });
}

/** The one payment of a bill. A second payment is refused, never taken. */
function pay(bill: Bill, payment: Payment): Bill | null {
  if (bill.payments.length > 0) return null;
  return { ...bill, payments: [payment] };
}

/** Any failure before the code: release reserved credit, void the hold, take nothing. */
function fail(state: State, reason: NotPaidReason): State {
  const q = quote(state);
  const record: BillRecord = { id: state.bill.id, outcome: reason, amount: q.amount, payment: null, voucherPrice: 0, tip: q.tip };
  return {
    ...state,
    wallet: { ...state.wallet, reserved: 0 },
    history: { ...state.history, bills: [...state.history.bills, record] },
    bill: { ...state.bill, step: "notPaid", notPaidReason: reason, hold: null, deadline: null },
  };
}

/** The waiter's code is in and any money is in: deduct the credit and close the bill. */
function finalize(state: State, payment: Payment | null): State {
  const q = quote(state);
  let bill = state.bill;
  if (payment) {
    const paid = pay(bill, payment);
    if (!paid) return state;
    bill = paid;
  }
  let wallet = { ...state.wallet };
  let history = { ...state.history };
  const offer = bill.upsell === "accepted" ? bill.offer : null;

  if (offer) {
    // The voucher is bought: its "now" credit lands, its bonus waits 3 h and
    // can never pay this bill.
    wallet.credit += offer.now;
    wallet.pending = [
      ...wallet.pending,
      ...offer.lines.flatMap((l) =>
        Array.from({ length: l.qty }, () => ({ voucher: l.voucher.name, amount: l.voucher.bonus, billId: bill.id })),
      ),
    ];
    if (offer.lines.some((l) => l.voucher.welcomeOnly)) wallet.welcomeUsed = true;
    history = {
      ...history,
      vouchersSold: history.vouchersSold + offer.count,
      moneyIn: history.moneyIn + offer.price,
      bonusOwed: history.bonusOwed + offer.bonus,
    };
  }

  // Credit pays food only, never the tip.
  wallet.credit -= q.totalCredit;
  wallet.reserved = 0;

  const tipHow: Method | null = q.tip > 0 ? (payment?.kind ?? null) : null;
  if (tipHow === "card") history = { ...history, tipsByCard: history.tipsByCard + q.tip };

  const receipt: Receipt = {
    bill: q.amount,
    creditUsed: q.totalCredit,
    voucher: offer ? { label: offer.lines.map((l) => (l.qty > 1 ? `${l.qty} × ${l.voucher.name}` : l.voucher.name)).join(" + "), price: offer.price, now: offer.now, bonus: offer.bonus } : null,
    paidByCard: payment?.kind === "card" ? payment.amount : 0,
    paidAtTable: payment?.kind === "cash" ? payment.amount : 0,
    tip: q.tip,
    tipHow,
    creditLeft: wallet.credit,
    pendingBonus: wallet.pending.reduce((s, p) => s + p.amount, 0),
  };
  const record: BillRecord = {
    id: bill.id,
    outcome: "paid",
    amount: q.amount,
    payment,
    voucherPrice: offer?.price ?? 0,
    tip: q.tip,
  };
  history = { ...history, bills: [...history.bills, record] };

  return { ...state, wallet, history, bill: { ...bill, step: "receipt", receipt, hold: null, deadline: null } };
}

export function transition(state: State, event: Event, now = 0): State {
  const { bill } = state;
  const at = (...steps: Step[]) => steps.includes(bill.step);

  switch (event.type) {
    case "RESTART": {
      const s = initialState(event.scenario, state.place, state.history);
      return s;
    }
    case "SET_PLACE": {
      const next = { ...state, place: structuredClone(event.place) };
      // A bill that has not started takes the new settings; an open one keeps its own.
      if (bill.step === "pick") next.bill = { ...bill, settings: structuredClone(event.place) };
      return next;
    }
  }

  if (!bill.settings.checkoutOn) return state;

  switch (event.type) {
    case "START":
      return at("pick") ? withBill(state, { step: "bill" }) : state;

    case "SET_AMOUNT":
      return at("bill") ? withBill(state, { amountText: event.text.replace(/[^0-9]/g, "").slice(0, 7), amountError: null }) : state;

    case "TOGGLE_CREDIT":
      return at("bill") ? withBill(state, { useCredit: !bill.useCredit }) : state;

    case "BILL_NEXT":
      if (!at("bill")) return state;
      if (parseAmount(bill.amountText) <= 0) return withBill(state, { amountError: copy.bill.errorAmount });
      return withBill(state, { step: "tip", amountError: null });

    case "SET_TIP":
      return at("tip") ? withBill(state, { tipKind: event.kind, tipError: null }) : state;

    case "SET_TIP_OTHER":
      return at("tip") ? withBill(state, { tipOther: event.text.replace(/[^0-9]/g, "").slice(0, 6), tipError: null }) : state;

    case "TIP_NEXT": {
      if (!at("tip")) return state;
      if (bill.tipKind === "other" && parseAmount(bill.tipOther) <= 0) return withBill(state, { tipError: copy.tip.errorOther });
      // The offer is shown once per bill: a skip stays a skip.
      if (bill.upsell === "skipped") return toMethodOrSign(withBill(state, { offer: null }), now);
      const offer = offerFor(state);
      if (!offer) return toMethodOrSign(withBill(state, { upsell: "none", offer: null }), now);
      // Bought before a failed Sign: keep the purchase choice, re-priced for the bill.
      if (bill.upsell === "accepted") return toMethodOrSign(withBill(state, { offer, method: "card" }), now);
      return withBill(state, { step: "upsell", upsell: "offered", offer });
    }

    case "UPSELL_BUY":
      if (!at("upsell") || !bill.offer) return state;
      return toMethodOrSign(withBill(state, { upsell: "accepted", method: "card" }), now);

    case "UPSELL_SKIP":
      if (!at("upsell")) return state;
      return toMethodOrSign(withBill(state, { upsell: "skipped", offer: null, method: null }), now);

    case "CHOOSE_METHOD": {
      if (!at("method")) return state;
      if (event.method === "card" && !cardAvailable(state)) return state;
      if (event.method === "cash" && !cashAvailable(state)) return state;
      return withBill(state, { method: event.method, methodError: null });
    }

    case "DROP_VOUCHER":
      if (!at("method") || bill.upsell !== "accepted") return state;
      return withBill(state, { upsell: "skipped", offer: null, method: null, methodError: null });

    case "METHOD_NEXT": {
      if (!at("method")) return state;
      if (!bill.method) return withBill(state, { methodError: copy.method.errorChoose });
      if (bill.method === "cash") return withBill(state, { step: "cashPay" });
      // Card: the bank says yes or no NOW, while the guest is alone. A decline changes nothing else.
      if (state.scenario.cardResult === "declined") {
        return withBill(state, { methodError: bill.upsell === "accepted" ? copy.method.declinedVoucher : copy.method.declined });
      }
      return enterSign(withBill(state, { hold: quote(state).due, methodError: null }), now);
    }

    case "CASH_PAID":
      return at("cashPay") ? enterSign(state, now) : state;

    case "BACK": {
      const back: Partial<Record<Step, Step>> = { bill: "pick", tip: "bill", upsell: "tip", method: bill.upsell === "offered" || bill.upsell === "accepted" ? "upsell" : "tip", cashPay: "method" };
      const to = back[bill.step];
      if (!to) return state;
      // Going back from Method to the offer re-opens it; going back past it re-decides it.
      if (to === "upsell" && bill.offer) return withBill(state, { step: "upsell", upsell: "offered", method: null, methodError: null });
      return withBill(state, { step: to, methodError: null, ...(to === "tip" && bill.upsell !== "skipped" ? { upsell: "none" as Upsell, offer: null } : {}) });
    }

    case "CANCEL":
      return at("sign") ? fail(state, "cancelled") : state;

    case "TIMEOUT":
      return at("sign") && bill.deadline !== null && now >= bill.deadline ? fail(state, "timeout") : state;

    case "WAITER_SCAN":
      return at("sign") ? withBill(state, { scanned: true }) : state;

    case "WAITER_CASH_CHECK":
      return at("sign") && bill.scanned ? withBill(state, { cashChecked: event.checked, waiterError: null }) : state;

    case "WAITER_CODE":
      return at("sign") && bill.scanned ? withBill(state, { code: event.text.replace(/[^0-9]/g, "").slice(0, 6), waiterError: null }) : state;

    case "WAITER_REJECT":
      return at("sign") && bill.scanned ? fail(state, "rejected") : state;

    case "WAITER_VERIFY": {
      if (!at("sign") || !bill.scanned) return state;
      if (bill.code.length < 6) return withBill(state, { waiterError: copy.waiter.errorShort });
      if (bill.code !== PLACE.code) return withBill(state, { waiterError: copy.waiter.errorWrong });
      const q = quote(state);
      if (bill.method === "cash" && !bill.cashChecked) return withBill(state, { waiterError: copy.waiter.errorCash });
      if (bill.method === "card" && bill.hold !== null) return withBill(state, { step: "cardPay", verified: true, waiterError: null });
      if (bill.method === "cash") return finalize(withBill(state, { verified: true }), { kind: "cash", amount: q.due });
      return finalize(withBill(state, { verified: true }), null);
    }

    case "CAPTURE": {
      if (!at("cardPay") || bill.hold === null) return state;
      return finalize(state, { kind: "card", amount: bill.hold });
    }

    case "START_AGAIN":
      if (!at("notPaid")) return state;
      return withBill(state, {
        step: "bill",
        method: bill.upsell === "accepted" ? "card" : null,
        methodError: null,
        hold: null,
        deadline: null,
        scanned: false,
        cashChecked: false,
        code: "",
        waiterError: null,
        verified: false,
        notPaidReason: null,
        payments: [],
      });

    case "DONE":
      if (!at("receipt")) return state;
      return { ...state, bill: { ...newBill(bill.id + 1, state.place, state.scenario), amountText: "" } };
  }
  return state;
}

/** Mesita's cut, shown in the console. */
export function fees(history: History) {
  return {
    vouchers: Math.round((history.moneyIn * FEE_PERCENT_VOUCHERS) / 100),
    tips: Math.round((history.tipsByCard * FEE_PERCENT_TIPS) / 100),
  };
}
