"use client";

// Offers (MESITA-3296; the Place states of Main §10 since MESITA-3589).
// FIVE BOXES SINCE MESITA-4871 (Waiter Codes); four since MESITA-4766 (Instagram Stories removed; five under
// MESITA-4744, six under MESITA-4732), each a card with its own
// anchor, which Monitor's "Turn on in Offers" links to:
//   Credits Account    #credits-account    · Credits Agreement · Credits Balance
//                                            (read-only) · Outstanding Credit
//                                            (#credit-limit: of the limit, and the
//                                            next step that raises it) · Accept
//                                            Credits Payments (Loyalty Cards: on
//                                            once signed, then locked)
//   Stripe Account     #stripe-account     · the account and its button
//   Visit Checkout     #visit-checkout     · Enabled (Cashback only since
//                                            MESITA-5067; no Discount) ·
//                                            Welcome Regular · Returning Regular ·
//                                            Welcome VIP · Returning VIP (three
//                                            picks each, Off included)
//   Waiter Codes       #waiter-codes       · one 6-digit code; optional at Discount (MESITA-4890)
//   Prepaid Vouchers   #prepaid-vouchers   · ONE master switch, Accept Prepayments
//                                            (the `prepayments` key, and
//                                            `stripe_payments` under it), then
//                                            Small · Medium · Big
// The rates and the voucher bonuses are one saved record (business-web-set-
// cashback).
// SAVE CHANGES (Pato, 2026-11-23, MESITA-4769: "don't enable to directly
// configurate. it must have like a save changes button"): every switch and
// pick in Visit Checkout and Prepaid Vouchers is a draft until Save changes,
// in a bar at the foot of the screen while anything is unsaved (Discard drops
// it). Agree and Enable on the Credits Agreement, the Stripe button and cash
// Received stay instant: they are actions, not settings.
// A switch that can't turn on is disabled and its row says the one missing
// step, with a link to it. Never "Mesita Pay" (Pato, 2026-11-10).
// The Loyalty Cards Agreement is independent of Stripe (Pato, 2026-11-09). A
// guest's credit is the place's debt: Loyalty Cards Off stops new credit,
// never what guests hold. The owner and Mesita staff change these; the
// server refuses anyone else and repeats each rule. Configuration only
// (MESITA-3596): the money and its log live on Monitor.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { moneyState, NOT_YET_SELLABLE, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ConfettiIcon,
  CrownSimpleIcon,
  HashIcon,
  ReceiptIcon,
  StripeLogoIcon,
  TicketIcon,
  WalletIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/shell/Page";
import { WaiterCodes } from "./WaiterCodes";
import { Switch } from "@/components/ui/config";
import { ERROR_BOX_CLASS, FOCUS_RING_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { placeTabHref, returnUrl } from "@/lib/routes";
import { guardUnsavedEdits } from "@/lib/unsaved-edits";
import { prepaymentsOn as prepaymentsLive, stripeTakesCards } from "@/lib/offers-state";
import { day } from "@/lib/format";
import { ticketWhen } from "@/lib/ticket-desk";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import {
  CASHBACK_DEFAULTS,
  type CashbackRates,
  VISIT_PICKS_BPS,
  type VisitRateField,
  VOUCHER_BONUS_PICKS_BPS,
  type VoucherBonusField,
} from "@/lib/cashback";
import {
  setPlaceCashback,
  openPaymentDashboard,
  type CreditLimit,
  getPlacePayments,
  type LoyaltyCardsContract,
  type PaymentAccount,
  type PaymentKey,
  type PaymentSettings,
  type PlacePayments,
  type StripeStage,
  receiveGuestCash,
  setPlacePayment,
  signLoyaltyCardsContract,
  startPaymentOnboarding,
} from "@/lib/business-api";
import { attempt } from "@/lib/attempt";

/** ONE LAYOUT FOR EVERY BOX (Pato, 2026-11-24, MESITA-4885: "more standarized
 *  … prettier and cleaner … same sections, same params"). A box is a header
 *  (mark, title, line, its one control), rows, then an optional footer. A row
 *  is text left and its value or controls right, all ending on one edge; on a
 *  phone, controls (not plain values) drop under the text. */
const ROW = "flex scroll-mt-24 items-center gap-4 px-5 py-3 text-sm sm:px-6 sm:min-h-17";
const STACK = "flex-wrap gap-y-2.5 sm:flex-nowrap";
const TEXT = "min-w-0 flex-1";
const STACK_TEXT = "min-w-0 basis-full sm:basis-0 sm:flex-1";
const CONTROLS = "flex w-full shrink-0 items-center justify-between gap-4 sm:w-auto sm:justify-end";
const VALUE = "shrink-0 text-right font-semibold whitespace-nowrap tabular-nums";
const ROWS = "divide-border border-border divide-y border-t";
const ACTION = cn(PILL_BUTTON_CLASS, "h-10 shrink-0 px-4 text-sm whitespace-nowrap");
const FOOT = "border-border bg-muted/40 text-muted-foreground space-y-1 border-t px-5 py-3 text-xs sm:px-6";
const NOTE = "text-muted-foreground text-xs";
const BLOCKED = "text-xs text-amber-800 dark:text-amber-300";
const SECTION = "flex flex-col overflow-hidden p-0 sm:p-0";
/** A voucher: its bonus field, one objective line, and the Offers page's face. */
type Product = { key: PaymentKey; name: string; line: string; field: VoucherBonusField; tone: string; icon: Icon };

// PRICED IN THE PLACE'S CURRENCY (MESITA-3914). TWIN of VOUCHER_PRICE_CENTS
// in _shared/money.ts. The base price per currency, in whole units
// (MESITA-3943); Small 2×, Medium 10×, Big 50× (MESITA-4152), Welcome and VIP
// at the base. TWIN of VOUCHER_CURRENCY_LIST in _shared/money.ts.
const SMALL: Record<string, number> = { MXN: 100, USD: 10, CAD: 10 };
const TIMES: Record<VoucherKey, number> = { voucher_200: 2, voucher_1000: 10, voucher_5000: 50, voucher_welcome: 1, voucher_vip: 1 };
const VOUCHER_PRICE: Record<string, Record<VoucherKey, number>> = Object.fromEntries(
  Object.entries(SMALL).map(([c, small]) => [
    c,
    Object.fromEntries(Object.entries(TIMES).map(([k, n]) => [k, small * 100 * n])) as Record<VoucherKey, number>,
  ]),
);

/** A voucher row before its price. */
type VoucherSeed = Omit<Product, "line" | "key"> & { key: VoucherKey };

// THE OWNER PICKS EACH BONUS (Pato, 2026-11-23, MESITA-4764: "small: 10% 20% ·
// mid 20 40 · big 30 60"); the prices stay.
const STANDARD: VoucherSeed[] = [
  { key: "voucher_200", name: "Small Voucher", field: "small_bonus_bps", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_1000", name: "Medium Voucher", field: "medium_bonus_bps", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_5000", name: "Big Voucher", field: "big_bonus_bps", tone: "bg-green-100 text-green-700", icon: TicketIcon },
];

/** An amount in whole units where it is whole: MX$10,000, MX$20, $12.50. */
function wholeMoney(cents: number, currency: string): string {
  const whole = Math.round(cents) % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return moneyLabel(cents, currency);
  }
}

/** Visit Checkout's four lines (MESITA-4698; VIP back since MESITA-4766; four since MESITA-4789),
 *  each Off or one of two rates, all always shown, paid out by the place's
 *  one mechanism (MESITA-4770: Discount off this bill, or Cashback for the
 *  next visit). `line` names Cashback; a Discount place reads Discount. */
const RATE_ROWS: Array<{ key: VisitRateField; id: string; name: string; line: string; icon: Icon }> = [
  // FOUR TIERS (Pato, 2026-11-23, MESITA-4789: "Welcome Regular, Returning
  // Regular, Welcome VIP, Returning VIP"), in his order.
  { key: "welcome_bps", id: "welcome-regular", name: "Welcome Regular", line: "Cashback on a guest's first bill here.", icon: ConfettiIcon },
  { key: "returning_bps", id: "returning-regular", name: "Returning Regular", line: "Cashback on every later bill here.", icon: ArrowsClockwiseIcon },
  { key: "welcome_vip_bps", id: "welcome-vip", name: "Welcome VIP", line: "Cashback on a VIP guest's first bill here.", icon: CrownSimpleIcon },
  {
    key: "returning_vip_bps",
    id: "returning-vip",
    name: "Returning VIP",
    line: "Cashback on every later bill of a VIP guest.",
    icon: CrownSimpleIcon,
  },
];
const pct = (bps: number) => `${bps / 100}%`;
/** Every visit rate at 0: what Enabled Off stores. */
const NO_RATES = { welcome_bps: 0, returning_bps: 0, returning_vip_bps: 0, welcome_vip_bps: 0 } as const;
const anyRate = (r: Pick<CashbackRates, VisitRateField>) => r.welcome_bps > 0 || r.returning_bps > 0 || r.returning_vip_bps > 0 || r.welcome_vip_bps > 0;

/** The voucher rows in the place's currency; none where vouchers aren't sold. */
function voucherProducts(currency: string, rates: CashbackRates): Product[] {
  const prices = VOUCHER_PRICE[currency];
  if (!prices) return [];
  return STANDARD.map((p) => {
    const bps = rates[p.field];
    const price = prices[p.key];
    const credit = price + Math.floor((price * bps) / 10000);
    return { ...p, line: `Guest pays ${moneyLabel(price, currency)}, gets ${moneyLabel(credit, currency)} of credit.` };
  });
}

/** What a card payment costs the place (MESITA-3461), in its currency (MESITA-3913). */
const per100 = (currency: string) =>
  `Per ${moneyLabel(100_00, currency)} by card: Stripe's card fee + ${moneyLabel(5_00, currency)} to Mesita.`;

/** The currency's name in the plural (MESITA-3913). */
const CURRENCY_NAME: Record<string, string> = {
  MXN: "Mexican pesos", USD: "US dollars", CAD: "Canadian dollars", EUR: "euros", GBP: "pounds sterling",
  BRL: "Brazilian reais", COP: "Colombian pesos", CLP: "Chilean pesos", PEN: "Peruvian soles", JPY: "Japanese yen",
};

/** The waiter's charge (MESITA-3306) and the staff list (MESITA-3462). */

type VoucherKey = Extract<PaymentKey, `voucher_${string}`>;
const isVoucherKey = (k: PaymentKey): k is VoucherKey => k.startsWith("voucher_");
/** The switches Save changes writes (MESITA-4769); every other key is an action. */
type DraftKey = "prepayments" | VoucherKey;

const CASHBACK_FIELDS: readonly (keyof CashbackRates)[] = [
  "welcome_bps",
  "returning_bps",
  "returning_vip_bps",
  "welcome_vip_bps",
  "visit_mechanism",
  "small_bonus_bps",
  "medium_bonus_bps",
  "big_bonus_bps",
];
const sameRates = (a: CashbackRates, b: CashbackRates) => CASHBACK_FIELDS.every((k) => a[k] === b[k]);

/** What Visit Checkout's Enabled switch comes back to when turned on again:
 *  the set with any rate on, else the defaults. */
const restoreRates = (c: CashbackRates): Pick<CashbackRates, VisitRateField> =>
  anyRate(c)
    ? { welcome_bps: c.welcome_bps, returning_bps: c.returning_bps, returning_vip_bps: c.returning_vip_bps, welcome_vip_bps: c.welcome_vip_bps }
    : {
        welcome_bps: CASHBACK_DEFAULTS.welcome_bps,
        returning_bps: CASHBACK_DEFAULTS.returning_bps,
        returning_vip_bps: CASHBACK_DEFAULTS.returning_vip_bps,
        welcome_vip_bps: CASHBACK_DEFAULTS.welcome_vip_bps,
      };

/** Why a switched-on voucher is not for sale yet (MESITA-3303). */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until the Stripe Account takes cards.",
  needs_loyalty_cards: "Not for sale until the Credits Account is on.",
  needs_billing: "Not for sale until Mesita's invoice is paid.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

/** The Stripe Account's seven values, in the owner's words. */
const STAGE_LABEL: Record<StripeStage, string> = {
  none: "Not connected",
  onboarding: "Onboarding",
  in_review: "In review",
  connected: "Connected",
  action_needed: "Action needed",
  payouts_paused: "Payouts paused",
  restricted: "Restricted",
};

const COUNTRY: Record<string, string> = {
  MX: "Mexico", US: "United States", CA: "Canada", GB: "United Kingdom", BR: "Brazil", JP: "Japan",
  ES: "Spain", FR: "France", DE: "Germany", IT: "Italy", NL: "Netherlands", PT: "Portugal", IE: "Ireland", BE: "Belgium", AT: "Austria",
};

/** The quiet grey pill (Cancel in the Agreement dialog). */
const QUIET_PILL_CLASS = "bg-muted text-foreground hover:bg-muted/70 hover:opacity-100";

function accountCopy(a: PaymentAccount): { line: string; button: string | null; open: boolean } {
  switch (a.state) {
    case "none":
      return { line: "Your own account, where prepaid vouchers land. Not needed for credits or cash.", button: "Connect Stripe", open: false };
    case "onboarding":
      return { line: "Setup not finished.", button: "Continue setup", open: false };
    case "restricted":
      return {
        line: a.requirements_due > 0 ? `Stripe needs ${a.requirements_due} more ${a.requirements_due === 1 ? "thing" : "things"} from you.` : "Stripe is reviewing your account.",
        button: "Finish setup",
        open: false,
      };
    case "ready":
      return { line: a.payouts_enabled ? "Ready: payments and payouts." : "Ready for payments. Payouts are still being set up.", button: "Open Stripe", open: true };
  }
}

function signedOn(c: LoyaltyCardsContract): string {
  if (!c.signed_at) return "Signed";
  // One fixed zone: the server and the browser print the same day.
  return `Signed ${day(c.signed_at)}`;
}

/** What the Credit Limit box says about where the limit comes from. */
function limitLine(c: CreditLimit): string {
  switch (c.tier) {
    case "none":
      return "No new credit until the Credits Account is on.";
    case "credits":
      return "Credits Account on.";
    case "stripe":
      return "Credits Account on and the Stripe Account takes cards.";
    case "custom":
      return "Set by Mesita for this place.";
    case "default":
      return `The standard limit in ${CURRENCY_NAME[c.currency] ?? c.currency}.`;
  }
}

export function PaymentsPanel({
  placeId,
  initial,
  back,
}: {
  placeId: string;
  initial: PlacePayments;
  back: "return" | "refresh" | null;
}) {
  const [settings, setSettings] = useState(initial.settings);
  const [cashDue, setCashDue] = useState(initial.cash_due ?? []);
  // SAVED: what the server holds. The page draws the draft over it.
  const [cashback, setCashback] = useState<CashbackRates>(initial.cashback ?? CASHBACK_DEFAULTS);
  // THE DRAFT (MESITA-4769): switch edits over `settings`, and the whole
  // cashback record once any rate or bonus is touched. An edit equal to the
  // saved value is dropped, so "unsaved" means something differs.
  const [edits, setEdits] = useState<Partial<Record<DraftKey, boolean>>>({});
  const [cashbackDraft, setCashbackDraft] = useState<CashbackRates | null>(null);
  const [saving, setSaving] = useState(false);
  // The rates Visit Checkout comes back to when enabled again (Off stores 0
  // for all three; MESITA-4752): the last saved set with any rate on.
  const [lastRates, setLastRates] = useState(() => restoreRates(initial.cashback ?? CASHBACK_DEFAULTS));
  // What the server last held with a rate on: where Discard goes back to, so
  // an abandoned draft never returns (MESITA-4918).
  const [savedRates, setSavedRates] = useState(lastRates);
  const currency = initial.currency ?? "MXN";
  const [contract, setContract] = useState<LoyaltyCardsContract>(initial.contract ?? { signed: false, signed_at: null, terms_version: null });
  const [agreeing, setAgreeing] = useState(false);
  const [busy, setBusy] = useState<PaymentKey | "stripe" | "contract" | "cashback" | null>(null);
  // The cash row being marked received (MESITA-4900: one request per tap).
  const [receiving, setReceiving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode, fee } = initial;
  // The tier moves when the Credits Account flips here; refetched then.
  const [creditLimit, setCreditLimit] = useState<CreditLimit | null>(initial.credit_limit ?? null);
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const stage: StripeStage = account.stage ?? (ready ? "connected" : account.state === "none" ? "none" : "onboarding");
  const pending = !canEdit || busy !== null || saving;
  // Prepayments and every voucher need the Stripe Account to take cards in
  // the server's mode (MESITA-3599; the set EF and SQL refuse otherwise).
  const takesCards = stripeTakesCards(initial);
  // What the page shows: the saved switches with the draft over them. Turning
  // Prepaid Vouchers on also turns on `stripe_payments` at Save (MESITA-3946).
  const view: PaymentSettings = {
    ...settings,
    ...edits,
    ...(edits.prepayments ? { stripe_payments: true } : null),
  };
  const rates = cashbackDraft ?? cashback;
  const draftKeys = Object.keys(edits) as DraftKey[];
  const dirty = draftKeys.length > 0 || cashbackDraft !== null;
  // The same rule the server sells and pays by (money-state, one source),
  // read from what is saved: "not for sale" is about the live place.
  const state = moneyState({ ...settings, has_place_code: true }, { charges_enabled: account.charges_enabled, fee_hold: fee.hold }, null);

  /** A switch into the draft; back to its saved value drops the edit. */
  function editSwitch(key: DraftKey, on: boolean) {
    const saved = key === "prepayments" ? prepaymentsLive(settings, takesCards) : settings[key];
    setEdits((e) => {
      const { [key]: _drop, ...rest } = e;
      void _drop;
      return on === saved ? rest : { ...rest, [key]: on };
    });
  }

  /** The cashback record into the draft; equal to the saved one drops it. */
  function editRates(next: CashbackRates) {
    const same = sameRates(next, cashback);
    setCashbackDraft(same ? null : next);
    // Back to a saved Off drops the rates picked on the way there.
    if (same && !anyRate(cashback)) setLastRates(savedRates);
  }

  function discard() {
    setEdits({});
    setCashbackDraft(null);
    setLastRates(savedRates);
    setError(null);
  }

  /** Save changes: the cashback record, then Prepaid Vouchers, then each
   *  voucher. A refused step stops there and keeps what is still unsaved. */
  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      if (cashbackDraft) {
        const r = await attempt(setPlaceCashback(placeId, cashbackDraft));
        if (!r.ok) return setError(r.error);
        setCashback(r.data);
        setCashbackDraft(null);
        // Saved Off keeps the rates it comes back to (MESITA-4752).
        if (anyRate(r.data)) {
          setLastRates(restoreRates(r.data));
          setSavedRates(restoreRates(r.data));
        }
      }
      let saved = settings;
      const order = [...draftKeys].sort((a, b) => Number(b === "prepayments") - Number(a === "prepayments"));
      for (const key of order) {
        const on = edits[key] === true;
        if (key === "prepayments" && on && !saved.stripe_payments) {
          const s = await attempt(setPlacePayment(placeId, "stripe_payments", true));
          if (!s.ok) return setError(s.error);
          saved = s.data;
          setSettings(saved);
        }
        const r = await attempt(setPlacePayment(placeId, key, on));
        if (!r.ok) return setError(r.error);
        saved = r.data;
        setSettings(saved);
        setEdits((e) => {
          const { [key]: _done, ...rest } = e;
          void _done;
          return rest;
        });
      }
    } finally {
      setSaving(false);
    }
  }

  // Unsaved edits: the deploy watcher never reloads over them, and closing
  // or reloading the tab asks first.
  useEffect(() => {
    if (!dirty) return;
    return guardUnsavedEdits("offers");
  }, [dirty]);

  async function flip(key: PaymentKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    const r = await attempt(setPlacePayment(placeId, key, enabled));
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
    if (key === "loyalty_cards") void refreshCreditLimit();
  }

  /** The Credit Limit box's tier follows the Credits Account; read it again. */
  async function refreshCreditLimit() {
    const r = await attempt(getPlacePayments(placeId));
    if (r.ok) setCreditLimit(r.data.credit_limit ?? null);
  }

  /** One choice of two: a grey track, the picked half raised. Halves are
   *  equal, so every track lines up down the page. */
  const segments = <T extends string | number>(
    label: string,
    values: readonly T[],
    shown: T,
    text: (v: T) => string,
    disabled: boolean,
    pick: (v: T) => void,
    width = "w-34",
  ) => (
    <div className={cn("bg-muted grid h-10 shrink-0 auto-cols-fr grid-flow-col rounded-full p-0.75", width)} role="group" aria-label={label}>
      {values.map((v) => {
        const picked = shown === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={picked}
            disabled={disabled}
            onClick={() => pick(v)}
            className={cn(
              "rounded-full text-sm tabular-nums transition-colors disabled:opacity-50",
              FOCUS_RING_CLASS,
              picked ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground hover:text-foreground font-medium",
            )}
          >
            {text(v)}
          </button>
        );
      })}
    </div>
  );

  async function agree() {
    setBusy("contract");
    setError(null);
    const r = await attempt(signLoyaltyCardsContract(placeId));
    setBusy(null);
    setAgreeing(false);
    if (!r.ok) return setError(r.error);
    setContract(r.data);
    // CREDITS ARE ALWAYS ON (Pato, 2026-11-23, MESITA-4752: "it's all in. If
    // they owe credits, they will accept in visit"): signing turns them on.
    if (!settings.loyalty_cards) await flip("loyalty_cards", true);
  }

  async function stripe() {
    setBusy("stripe");
    setError(null);
    const r = await attempt(copy.open ? openPaymentDashboard(placeId) : startPaymentOnboarding(placeId, returnUrl(placeTabHref(placeId, "payments"))));
    if (!r.ok) {
      setBusy(null);
      return setError(r.error);
    }
    window.location.assign(r.data.url);
  }


  /** A box's header: mark, title, line, and its one control on the right. */
  const head = (Mark: Icon, title: string, opts: { line?: React.ReactNode; control?: React.ReactNode; id?: string; state?: string; stack?: boolean; stripe?: boolean } = {}) => (
    <header id={opts.id} data-place-state={opts.state} className={cn("flex scroll-mt-24 items-center gap-4 px-5 py-4 text-sm sm:px-6", opts.stack && STACK)}>
      <div className={cn("flex items-center gap-4", opts.stack ? STACK_TEXT : TEXT)}>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", opts.stripe ? "bg-[#635BFF] text-white" : "bg-muted text-foreground")}>
          <Mark size={20} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-sans text-base font-semibold">{title}</h2>
          {opts.line}
        </div>
      </div>
      {opts.control}
    </header>
  );
  const line = (text: React.ReactNode) => <p className="text-muted-foreground">{text}</p>;

  /** The one missing step, linked to the box that does it. */
  const step = (text: string, href: string) => (
    <a className="underline underline-offset-2" href={href}>
      {text}
    </a>
  );
  const needsContract = step("Sign the Credits Agreement first.", "#loyalty-cards-agreement");
  const needsCredits = step("Enable the Credits Account first.", "#loyalty-cards-agreement");
  const needsStripe = step("Connect the Stripe Account first.", "#stripe-account");
  const needsPrepayments = step("Enable Prepaid Vouchers first.", "#accept-prepayments");
  const creditsSet = contract.signed && settings.loyalty_cards;
  const creditsBlock = settings.loyalty_cards ? null : contract.signed ? needsCredits : needsContract;

  /** A row's one line under its title: the missing step if blocked, else its note. */
  const under = (blocked: React.ReactNode, note: React.ReactNode) =>
    blocked ? <p className={BLOCKED}>{blocked}</p> : note ? <p className={NOTE}>{note}</p> : null;

  // Accept Prepayments is over every voucher (MESITA-4300): while it reads
  // Off, each voucher reads Off with its switch disabled and the one step; the
  // stored choice is kept and comes back when it is on.
  const prepaymentsOn = prepaymentsLive(view, takesCards);
  const prepaymentsBlocked = prepaymentsOn ? null : !takesCards ? needsStripe : creditsBlock;
  const vouchers = voucherProducts(currency, rates).filter((p) => !isVoucherKey(p.key) || !NOT_YET_SELLABLE[p.key]);
  const anyTierOn = vouchers.some((p) => view[p.key]);

  const voucherRow = ({ key, name, line, field }: Product) => {
    const on = view[key] && prepaymentsOn;
    const reason = isVoucherKey(key) ? state.unavailable[key] : undefined;
    const blocked = !takesCards ? needsStripe : !prepaymentsOn ? needsPrepayments : !on && !settings.loyalty_cards ? creditsBlock : null;
    const note = on && reason && NOT_SELLING[reason] ? NOT_SELLING[reason] : null;
    return (
      <li key={key} className={cn(ROW, STACK)} data-place-state={key}>
        <div className={STACK_TEXT}>
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{line}</p>
          {/* The header already says the box's own missing step. */}
          {under(prepaymentsBlocked ? null : blocked, note)}
        </div>
        <div className={CONTROLS}>
        {segments(`${name} bonus`, VOUCHER_BONUS_PICKS_BPS[field], rates[field], (b) => `+${pct(b)}`, pending || !!blocked, (b) =>
          editRates({ ...rates, [field]: b }),
        )}
        <Switch
          on={on}
          pending={pending || !!blocked}
          onClick={() => isVoucherKey(key) && editSwitch(key, !on)}
          label={`${name}: ${on ? "on" : "off"}`}
        />
        </div>
      </li>
    );
  };

  // Cashback needs the Credits Agreement (new credit is born only while the
  // Credits Account is on). Discount is gone (Pato, 2026-11-27, MESITA-5067).
  const visitBlock = creditsBlock;
  const visitOn = settings.loyalty_cards && anyRate(rates);

  return (
    <>
      {testMode ? <TestBand className="rounded-2xl px-5 sm:px-6" detail="Stripe sandbox: guests pay with Stripe's test cards, no real money moves." /> : null}
      {fee.hold ? (
        <p className={cn(ERROR_BOX_CLASS, "flex flex-wrap items-center justify-between gap-3")} data-fee-hold>
          <span>
            Mesita&apos;s invoice
            {fee.invoice ? ` of ${moneyLabel(fee.invoice.amount_cents, fee.invoice.currency)}` : ""} is unpaid, so card payments and vouchers are off.
            They come back on by themselves once it is paid.
          </span>
          {fee.invoice?.url ? (
            <a className={cn(PILL_BUTTON_CLASS, "shrink-0")} href={fee.invoice.url} target="_blank" rel="noreferrer">
              Pay invoice
            </a>
          ) : null}
        </p>
      ) : null}

      <div id="credits-account" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(WalletIcon, "Credits Account")}
          <ul className={ROWS}>
            <li id="loyalty-cards-agreement" className={cn(ROW, !creditsSet && STACK)} data-place-state="loyalty_cards_contract">
              <div className={creditsSet ? TEXT : STACK_TEXT}>
                <p className="font-medium">Credits Agreement</p>
                <p className="text-muted-foreground">Your agreement with Mesita to run credits here. Separate from Stripe.</p>
              </div>
              <div className={creditsSet ? undefined : CONTROLS}>
                <p className={cn(VALUE, !contract.signed && "text-muted-foreground")}>{contract.signed ? signedOn(contract) : "Not signed"}</p>
                {creditsSet ? null : contract.signed ? (
                  <button type="button" className={ACTION} disabled={pending} onClick={() => void flip("loyalty_cards", true)}>
                    Enable
                  </button>
                ) : (
                  <button type="button" className={ACTION} disabled={pending} onClick={() => setAgreeing(true)}>
                    Agree
                  </button>
                )}
              </div>
            </li>
            {/* CREDITS LIMIT · CREDITS OUTSTANDING (Pato, 2026-11-23, MESITA-4752:
                "Credits Agreement · Credits Limit · Credits Outstanding (remove
                Credit Balance, it's redundant)"). The Accept Credits Payments
                switch is gone: signing turns credits on, and they stay on.
                Older servers send no limit: no rows. */}
            {creditLimit ? (
              <li id="credit-limit" className={ROW} data-place-state="credit_limit">
                <div className={TEXT}>
                  <p className="font-medium">Credits Limit</p>
                  <p className="text-muted-foreground">{limitLine(creditLimit)}</p>
                  {creditLimit.next ? (
                    <p className={BLOCKED}>
                      {creditLimit.next.step === "credits"
                        ? step(`Enable Credits Account → ${wholeMoney(creditLimit.next.limit_cents, creditLimit.currency)}`, "#loyalty-cards-agreement")
                        : step(`Connect Stripe Account → ${wholeMoney(creditLimit.next.limit_cents, creditLimit.currency)}`, "#stripe-account")}
                    </p>
                  ) : null}
                </div>
                <p className={cn(VALUE, creditLimit.limit_cents === null && "text-muted-foreground")}>
                  {creditLimit.limit_cents === null ? "No new credit" : wholeMoney(creditLimit.limit_cents, creditLimit.currency)}
                </p>
              </li>
            ) : null}
            {creditLimit ? (
              <li id="credits-outstanding" className={ROW} data-place-state="credits_outstanding">
                <div className={TEXT}>
                  <p className="font-medium">Credits Outstanding</p>
                  <p className="text-muted-foreground">What guests hold here now: your debt, always honoured.</p>
                </div>
                <p className={VALUE}>{wholeMoney(creditLimit.outstanding_cents, creditLimit.currency)}</p>
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div id="stripe-account" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(StripeLogoIcon, "Stripe Account", {
            state: "stripe",
            stack: true,
            stripe: true,
            line: line(
              ready
                ? ["Managed by Stripe", account.country ? COUNTRY[account.country] ?? account.country : null, testMode ? "Sandbox" : "Live", copy.line].filter(Boolean).join(" · ")
                : `${copy.line}${testMode ? " Sandbox." : ""}`,
            ),
            control: (
              <div className={CONTROLS}>
                <p className={cn(VALUE, !ready && "text-muted-foreground")}>{STAGE_LABEL[stage]}</p>
                {copy.button ? (
                  // Stripe's purple in every state (Pato, 2026-11-24, MESITA-4885).
                  <button
                    type="button"
                    className={cn(ACTION, "bg-[#635BFF] text-white hover:bg-[#5249e6] hover:opacity-100")}
                    disabled={pending}
                    onClick={() => void stripe()}
                  >
                    {busy === "stripe" ? "Opening…" : copy.button}
                    {ready && busy !== "stripe" ? <ArrowSquareOutIcon size={16} weight="bold" aria-hidden /> : null}
                  </button>
                ) : null}
              </div>
            ),
          })}
        </Card>
      </div>

      {/* VISIT CHECKOUT (MESITA-4732): how a guest pays the bill at the visit,
          and the cashback it earns. Mesita Credits has no switch: a guest's
          credit is the place's debt, always honoured. */}
      <div id="visit-checkout" className="scroll-mt-24">
        <Card className={SECTION}>
          {/* ENABLED (Pato, 2026-11-23, MESITA-4752): cash, card and credits
              are always accepted at the visit, so no switch asks; the header's
              switch is whether a bill here earns (Off stores 0 for every rate). */}
          {head(ReceiptIcon, "Visit Checkout", {
            id: "visit-checkout-enabled",
            state: "visit_checkout",
            line: (
              <>
                {line("Guests pay the bill here by cash or credit, and earn cashback.")}
                {under(visitBlock, null)}
              </>
            ),
            control: (
              <Switch
                on={visitOn}
                pending={pending || !!visitBlock}
                onClick={() => {
                  if (visitOn) {
                    setLastRates(restoreRates(rates));
                    editRates({ ...rates, ...NO_RATES });
                  } else editRates({ ...rates, ...lastRates });
                }}
                label={`Visit Checkout: ${visitOn ? "on" : "off"}`}
              />
            ),
          })}
          <ul className={ROWS}>
            {/* LIKE A VOUCHER ROW (Pato, 2026-11-23, MESITA-4789: "same design
                for these cashback mechanics"): two rate pills, then the
                voucher's switch for On/Off; no Off pill. Off keeps the last
                rate on its pill, greyed, and On brings it back. */}
            {RATE_ROWS.map((row) => {
              const live = settings.loyalty_cards ? rates[row.key] : 0;
              const on = live > 0;
              const steps = VISIT_PICKS_BPS[row.key].filter((b) => b > 0);
              const remembered = lastRates[row.key] > 0 ? lastRates[row.key] : CASHBACK_DEFAULTS[row.key] > 0 ? CASHBACK_DEFAULTS[row.key] : steps[0];
              const locked = pending || !!visitBlock;
              return (
                <li key={row.key} id={row.id} className={cn(ROW, STACK)} data-place-state={row.key}>
                  <div className={STACK_TEXT}>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-muted-foreground">{row.line}</p>
                  </div>
                  <div className={CONTROLS}>
                  {segments(row.name, steps, on ? live : remembered, pct, locked || !on, (b) => editRates({ ...rates, [row.key]: b }))}
                  <Switch
                    on={on}
                    pending={locked}
                    onClick={() => {
                      if (on) {
                        setLastRates((l) => ({ ...l, [row.key]: live }));
                        editRates({ ...rates, [row.key]: 0 });
                      } else {
                        editRates({ ...rates, [row.key]: remembered });
                      }
                    }}
                    label={`${row.name}: ${on ? "on" : "off"}`}
                  />
                  </div>
                </li>
              );
            })}
          </ul>
          {/* GUESTS WHO CAME BACK (Pato, 2026-11-27, MESITA-5069): the owner
              sees cashback working. Read-only; the server counts it. */}
          {initial.came_back ? (
            <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3 text-sm sm:px-6" data-place-state="came_back">
              <p className="text-muted-foreground">
                {initial.came_back.guests === 0
                  ? `No guest came back to spend their cashback in the last ${initial.came_back.days} days yet.`
                  : `${initial.came_back.guests} ${initial.came_back.guests === 1 ? "guest" : "guests"} came back to spend their cashback in the last ${initial.came_back.days} days, and spent ${wholeMoney(initial.came_back.spent_cents, currency)}.`}
              </p>
            </div>
          ) : null}
          {cashDue.length > 0 ? (
            <ul className="divide-border border-border divide-y border-t" data-cash-due>
              {cashDue.map((row) => (
                <li key={row.attempt_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                  <span>
                    <span className="font-semibold">{row.cash_cents > 0 ? moneyLabel(row.cash_cents, currency) : `${moneyLabel(row.credit_cents ?? 0, currency)} in credits`}</span>
                    <span className="text-muted-foreground"> · {row.guest_label} · {ticketWhen(row.created_at, "America/Monterrey")}</span>
                  </span>
                  <button
                    type="button"
                    className={ACTION}
                    disabled={!canEdit || receiving !== null}
                    onClick={() => {
                      const amount = row.cash_cents > 0 ? moneyLabel(row.cash_cents, currency) : `${moneyLabel(row.credit_cents ?? 0, currency)} in credits`;
                      if (!window.confirm(`Mark ${amount} received?`)) return;
                      setReceiving(row.attempt_id);
                      setError(null);
                      void attempt(receiveGuestCash(placeId, row.attempt_id, row.cash_cents)).then((r) => {
                        setReceiving(null);
                        if (!r.ok) return setError(r.code === "amount_changed" ? "Amount changed. Refresh this list." : r.error);
                        setCashDue((rows) => rows.filter((x) => x.attempt_id !== row.attempt_id));
                      });
                    }}
                  >
                    {receiving === row.attempt_id ? "Saving…" : "Received"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <footer className={FOOT} data-waiter-charge>
            <p>
              A confirmed bill earns cashback on the part not paid with credit, never the tip, 1 hour later, up to $1,000MX per bill.
            </p>
            <p>VIP guests: by invitation code.</p>
          </footer>
        </Card>
      </div>

      {/* WAITER CODE, one per place (MESITA-4904). Configuration only: a typed
          name is on the visit (Pato, MESITA-4890: "just to configure, not to monitor"). */}
      <div id="waiter-codes" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(HashIcon, "Visit Checkout - Waiter Code", {
            line: line("Staff scan the guest's QR and type this code to send the bill."),
          })}
          <WaiterCodes placeId={placeId} initialCode={initial.staff_code} initialAskName={initial.name_required} initialNoCode={initial.no_code === true} mechanism={rates.visit_mechanism} savedMechanism={cashback.visit_mechanism} canEdit={canEdit} onError={setError} />
        </Card>
      </div>

      {/* PREPAID VOUCHERS (MESITA-4732): ONE master switch, Accept Prepayments,
          over the tiers. It stands for `prepayments` and the old Accept Stripe
          Payments (`stripe_payments`) gate, which no longer has a row. */}
      <div id="prepaid-vouchers" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(TicketIcon, "Prepaid Vouchers", {
            id: "accept-prepayments",
            state: "prepayments",
            line: (
              <>
                {line("Guests pay by card through your Stripe Account")}
                {under(prepaymentsBlocked, prepaymentsOn && fee.hold ? "Off until Mesita's invoice is paid." : null)}
              </>
            ),
            control: (
              <Switch
                on={prepaymentsOn}
                pending={pending || !!prepaymentsBlocked}
                onClick={() => editSwitch("prepayments", !prepaymentsOn)}
                label={`Prepaid Vouchers: ${prepaymentsOn ? "on" : "off"}`}
              />
            ),
          })}
          <ul className={ROWS} data-place-state="vouchers">
            {/* Small, Medium, Big; what money-state's NOT_YET_SELLABLE lists is off sale. */}
            {vouchers.map(voucherRow)}
          </ul>
          <footer className={FOOT}>
            <p>{per100(currency)} You get the money now; the bonus lands 3 hours later.</p>
            {!anyTierOn ? <p>No vouchers available</p> : null}
          </footer>
        </Card>
      </div>

      {agreeing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={() => !pending && setAgreeing(false)} onKeyDown={(e) => e.key === "Escape" && !pending && setAgreeing(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hc-agreement-title"
            className="bg-background w-full max-w-sm rounded-2xl p-6 text-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="hc-agreement-title" className="text-base font-semibold">
              Credits Agreement
            </h2>
            <p className="text-muted-foreground mt-2">{contract.text ?? "The full agreement will be added before launch."}</p>
            {/* MESITA-3923: the currency is agreed here, and fixed by the signature. */}
            <p className="mt-2 font-medium" data-agreement-currency>
              Your credits run in {currency} ({CURRENCY_NAME[currency] ?? currency}). Signing fixes it.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={cn(PILL_BUTTON_CLASS, QUIET_PILL_CLASS)} autoFocus disabled={busy === "contract"} onClick={() => setAgreeing(false)}>
                Cancel
              </button>
              <button type="button" className={PILL_BUTTON_CLASS} disabled={busy === "contract"} onClick={() => void agree()}>
                {busy === "contract" ? "Signing…" : "Agree"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {back === "return" && account.state !== "ready" && !error ? (
        <p className="text-muted-foreground text-sm">Stripe is still checking your details. This page updates when it answers.</p>
      ) : null}
      {error && !(dirty || saving) ? (
        // In view from every box: the row that failed may be far above (MESITA-4900).
        <p role="alert" className={cn(ERROR_BOX_CLASS, "bg-card sticky bottom-4 z-40")}>
          {error}
        </p>
      ) : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change offers.</p> : null}

      {/* THE ONE SAVE (MESITA-4769), PlaceSaveBar's look: at the foot of the
          screen while anything is unsaved, so it is reachable from every box. */}
      {dirty || saving ? (
        <div
          className="pointer-events-none sticky inset-x-0 bottom-0 z-40 flex justify-center pb-4 sm:pb-6"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          data-offers-save
        >
          <div className="border-border bg-card shadow-elev pointer-events-auto flex w-full flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-4 sm:rounded-full sm:py-2.5 sm:pr-2.5 sm:pl-5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5" aria-live="polite">
              {saving ? (
                <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <span className="bg-foreground h-2 w-2 shrink-0 animate-pulse rounded-full" aria-hidden />
              )}
              <span className="min-w-0 text-sm font-semibold">
                {saving ? "Saving…" : "Unsaved changes"}
                {error && !saving ? <span role="alert" className="text-destructive block font-medium">{error}</span> : null}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={discard}
                disabled={saving}
                className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void saveAll()}
                disabled={saving || !canEdit}
                className="bg-pink-gradient shadow-save inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
