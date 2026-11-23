"use client";

// Offers (MESITA-3296; the Place states of Main §10 since MESITA-3589).
// SIX BOXES SINCE MESITA-4732 (Pato, 2026-11-23, design review D1–D4), each
// a card with its own anchor, which Monitor's "Turn on in Offers" links to:
//   Credit Limit       #credit-limit       · Outstanding Credit of the limit, and
//                                            the next step that raises it
//   Credits Account    #credits-account    · Credits Agreement · Credits Balance
//                                            (read-only) · Accept Credits Payments
//                                            (Loyalty Cards: on once signed, then locked)
//   Stripe Account     #stripe-account     · the account and its button
//   Visit Checkout     #visit-checkout     · Accept Cash Payments · Mesita Credits
//                                            (always accepted, no switch) · Welcome
//                                            and Returning Visit Rates (cashback)
//   Prepaid Vouchers   #prepaid-vouchers   · ONE master switch, Accept Prepayments
//                                            (the `prepayments` key, and
//                                            `stripe_payments` under it), then
//                                            Small · Medium · Big
//   Instagram Stories  #instagram-stories  · Enable Story Rewards · Place Username
//                                            (read-only, from Profile) · Story Credit
// The rates and the story reward are one saved record (business-web-set-
// cashback); each change saves at once. Story Rewards Off stores 0; On brings
// back the last amount, or MX$20.
// A switch that can't turn on is disabled and its row says the one missing
// step, with a link to it. Never "Mesita Pay" (Pato, 2026-11-10).
// The Loyalty Cards Agreement is independent of Stripe (Pato, 2026-11-09). A
// guest's credit is the place's debt: Loyalty Cards Off stops new credit,
// never what guests hold. The owner and Mesita staff change these; the
// server refuses anyone else and repeats each rule. Configuration only
// (MESITA-3596): the money and its log live on Monitor.

import { useState } from "react";
import { moneyState, NOT_YET_SELLABLE, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ConfettiIcon,
  CreditCardIcon,
  GaugeIcon,
  InstagramLogoIcon,
  MoneyIcon,
  PiggyBankIcon,
  ReceiptIcon,
  SignatureIcon,
  StripeLogoIcon,
  TicketIcon,
  WalletIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { ERROR_BOX_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { placeTabHref, returnUrl } from "@/lib/routes";
import { prepaymentsOn as prepaymentsLive, stripeTakesCards } from "@/lib/offers-state";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { CASHBACK_DEFAULTS, CASHBACK_STEPS_BPS, type CashbackRates, STORY_REWARD_STEPS_CENTS } from "@/lib/cashback";
import {
  setPlaceCashback,
  openPaymentDashboard,
  type CreditLimit,
  getPlacePayments,
  type LoyaltyCardsContract,
  type PaymentAccount,
  type PaymentKey,
  type PlacePayments,
  type StripeStage,
  receiveGuestCash,
  setPlacePayment,
  signLoyaltyCardsContract,
  startPaymentOnboarding,
} from "@/lib/business-api";

/** One row: mark · title and line · value · control; the line wraps, the rest hold.
 *  SYMMETRY (Pato, 2026-11-23, MESITA-4744: "keep symmetry."): every row is
 *  its own grid, so auto value and control tracks landed at a different x on
 *  each row. Both get the same minimum width and sit right-aligned, so every
 *  value and every switch or select line up down the page. */
const MARK_ROW =
  "grid min-h-16 scroll-mt-24 grid-cols-[auto_minmax(0,1fr)_minmax(8rem,auto)_minmax(6rem,auto)] items-center gap-4 px-5 py-3 text-sm sm:px-6 [&>*:nth-child(3)]:justify-self-end [&>*:nth-child(3)]:text-right [&>*:nth-child(4)]:justify-self-end";
const HEAD = "flex items-center gap-2 px-5 pt-4 pb-2 font-semibold sm:px-6";
const NOTE = "text-muted-foreground text-xs";
const BLOCKED = "text-xs text-amber-800 dark:text-amber-300";
const SECTION = "flex flex-col p-0 sm:p-0";
/** The rate select fills the control slot (6rem), like a switch's place. */
const SELECT = "border-border bg-background w-24 rounded-full border px-3 py-1.5 text-sm";

/** A voucher: its bonus, one objective line, and the Offers page's face. */
type Product = { key: PaymentKey; name: string; line: string; value: string; tone: string; icon: Icon };

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

/** A voucher row before its price: the bonus in bps. */
type VoucherSeed = Omit<Product, "line" | "key"> & { key: VoucherKey; bps: number };

const STANDARD: VoucherSeed[] = [
  { key: "voucher_200", name: "Small Voucher", bps: 1000, value: "+10%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_1000", name: "Medium Voucher", bps: 2000, value: "+20%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_5000", name: "Big Voucher", bps: 3000, value: "+30%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
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

/** Visit Checkout's two cashback lines (MESITA-4698; no VIP since MESITA-4709). */
const RATE_ROWS: Array<{ key: keyof Omit<CashbackRates, "story_reward_cents">; name: string; line: string; icon: Icon }> = [
  { key: "welcome_bps", name: "Welcome Visit Rate", line: "Cashback on a guest's first bill here.", icon: ConfettiIcon },
  { key: "returning_bps", name: "Returning Visit Rate", line: "Cashback on every later bill here.", icon: ArrowsClockwiseIcon },
];
const pct = (bps: number) => (bps === 0 ? "Off" : `${bps / 100}%`);
/** The story amounts a place can pick (Off is the switch). */
const STORY_AMOUNTS = STORY_REWARD_STEPS_CENTS.filter((c) => c > 0);

/** The voucher rows in the place's currency; none where vouchers aren't sold. */
function voucherProducts(currency: string): Product[] {
  const prices = VOUCHER_PRICE[currency];
  if (!prices) return [];
  return STANDARD.map(({ bps, ...p }) => {
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
const VISIT_ORIGIN = "https://visit.mesita.ai";

type VoucherKey = Extract<PaymentKey, `voucher_${string}`>;
const isVoucherKey = (k: PaymentKey): k is VoucherKey => k.startsWith("voucher_");

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

/** The quiet grey pill (Cancel in the Agreement dialog, Open Stripe). */
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
  const d = new Date(c.signed_at);
  return `Signed ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
}

/** "@handle" from a profile's Instagram link; the link itself if it has none. */
function instagramHandle(url: string): string {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)/i) ?? url.match(/^@?([A-Za-z0-9._]+)$/);
  return m ? `@${m[1]}` : url;
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
  const [cashback, setCashback] = useState<CashbackRates>(initial.cashback ?? CASHBACK_DEFAULTS);
  // The amount Story Rewards comes back to when switched on again (Off stores 0).
  const [lastStory, setLastStory] = useState<number>((initial.cashback?.story_reward_cents ?? 0) > 0 ? initial.cashback!.story_reward_cents : 2000);
  const currency = initial.currency ?? "MXN";
  const [contract, setContract] = useState<LoyaltyCardsContract>(initial.contract ?? { signed: false, signed_at: null, terms_version: null });
  const [agreeing, setAgreeing] = useState(false);
  const [busy, setBusy] = useState<PaymentKey | "stripe" | "contract" | "cashback" | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode, fee } = initial;
  // The tier moves when the Credits Account flips here; refetched then.
  const [creditLimit, setCreditLimit] = useState<CreditLimit | null>(initial.credit_limit ?? null);
  const instagramUrl = initial.instagram_url ?? null;
  const chargeUrl = `${VISIT_ORIGIN}/charge/${encodeURIComponent(placeId)}`;
  const staffListUrl = `${VISIT_ORIGIN}/payments/${encodeURIComponent(placeId)}`;
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const stage: StripeStage = account.stage ?? (ready ? "connected" : account.state === "none" ? "none" : "onboarding");
  const pending = !canEdit || busy !== null;
  // Prepayments and every voucher need the Stripe Account to take cards in
  // the server's mode (MESITA-3599; the set EF and SQL refuse otherwise).
  const takesCards = stripeTakesCards(initial);
  // The same rule the server sells and pays by (money-state, one source).
  const state = moneyState({ ...settings, has_place_code: true }, { charges_enabled: account.charges_enabled, fee_hold: fee.hold }, null);
  const balance = initial.credits_balance ?? null;

  async function flip(key: PaymentKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    const r = await setPlacePayment(placeId, key, enabled);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
    if (key === "loyalty_cards") void refreshCreditLimit();
  }

  /** The Credit Limit box's tier follows the Credits Account; read it again. */
  async function refreshCreditLimit() {
    const r = await getPlacePayments(placeId);
    if (r.ok) setCreditLimit(r.data.credit_limit ?? null);
  }

  /** Accept Prepayments (MESITA-4732): one switch over `prepayments` and the
   *  `stripe_payments` gate above it (MESITA-3946), which has no row now. */
  async function flipPrepayments(enabled: boolean) {
    setBusy("prepayments");
    setError(null);
    if (enabled && !settings.stripe_payments) {
      const s = await setPlacePayment(placeId, "stripe_payments", true);
      if (!s.ok) {
        setBusy(null);
        return setError(s.error);
      }
      setSettings(s.data);
    }
    const r = await setPlacePayment(placeId, "prepayments", enabled);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
  }

  /** Rates and the story reward are one record; each change saves it. */
  async function saveRates(next: CashbackRates) {
    const before = cashback;
    setCashback(next);
    setBusy("cashback");
    setError(null);
    const r = await setPlaceCashback(placeId, next);
    setBusy(null);
    if (!r.ok) {
      setCashback(before);
      return setError(r.error);
    }
    setCashback(r.data);
    if (r.data.story_reward_cents > 0) setLastStory(r.data.story_reward_cents);
  }

  async function agree() {
    setBusy("contract");
    setError(null);
    const r = await signLoyaltyCardsContract(placeId);
    setBusy(null);
    setAgreeing(false);
    if (!r.ok) return setError(r.error);
    setContract(r.data);
  }

  async function stripe() {
    setBusy("stripe");
    setError(null);
    const r = copy.open ? await openPaymentDashboard(placeId) : await startPaymentOnboarding(placeId, returnUrl(placeTabHref(placeId, "payments")));
    if (!r.ok) {
      setBusy(null);
      return setError(r.error);
    }
    window.location.assign(r.data.url);
  }

  const mark = (Mark: Icon, on: boolean, tone: string) => (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? tone : "bg-muted text-muted-foreground")}>
      <Mark size={22} weight={on ? "fill" : "regular"} aria-hidden />
    </span>
  );

  /** A box's heading, with its Phosphor mark. */
  const head = (Mark: Icon, title: string) => (
    <h2 className={HEAD}>
      <Mark size={18} weight="bold" aria-hidden className="text-muted-foreground" />
      {title}
    </h2>
  );

  /** The one missing step, linked to the box that does it. */
  const step = (text: string, href: string) => (
    <a className="underline underline-offset-2" href={href}>
      {text}
    </a>
  );
  const needsContract = step("Sign the Credits Agreement first.", "#loyalty-cards-agreement");
  const needsCredits = step("Turn the Credits Account on first.", "#credits-account");
  const needsStripe = step("Connect the Stripe Account first.", "#stripe-account");
  const needsPrepayments = step("Turn Accept Prepayments on first.", "#accept-prepayments");
  const creditsBlock = settings.loyalty_cards ? null : contract.signed ? needsCredits : needsContract;

  /** A row's one line under its title: the missing step if blocked, else its note. */
  const under = (blocked: React.ReactNode, note: React.ReactNode) =>
    blocked ? <p className={BLOCKED}>{blocked}</p> : note ? <p className={NOTE}>{note}</p> : null;

  /** One way to pay at the visit: Accept with its switch, or "always" with none. */
  const pairRow = (args: {
    id: string;
    name: string;
    line: string;
    icon: Icon;
    tone: string;
    accept: "always" | { key: PaymentKey; blocked?: React.ReactNode };
  }) => {
    const a = args.accept;
    const aOn = a === "always" ? true : settings[a.key];
    const aBlocked = a === "always" || aOn ? undefined : a.blocked;
    return (
      <li key={args.id} id={args.id} className={MARK_ROW} data-place-state={a === "always" ? "credits_payments" : a.key}>
        {mark(args.icon, aOn, args.tone)}
        <div className="min-w-0">
          <p className="font-medium">{args.name}</p>
          <p className="text-muted-foreground">{args.line}</p>
          {under(aBlocked, null)}
        </div>
        <p className={cn("font-semibold whitespace-nowrap", (!aOn || a === "always") && "text-muted-foreground")}>
          {a === "always" ? "Always accepted" : aOn ? "On" : "Off"}
        </p>
        {a === "always" ? (
          <span />
        ) : (
          <Switch on={aOn} pending={pending || !!aBlocked} onClick={() => void flip(a.key, !aOn)} label={`${args.name}: ${aOn ? "on" : "off"}`} />
        )}
      </li>
    );
  };

  // Accept Prepayments is over every voucher (MESITA-4300): while it reads
  // Off, each voucher reads Off with its switch disabled and the one step; the
  // stored choice is kept and comes back when it is on.
  const prepaymentsOn = prepaymentsLive(settings, takesCards);
  const prepaymentsBlocked = prepaymentsOn ? null : !takesCards ? needsStripe : creditsBlock;
  const vouchers = voucherProducts(currency).filter((p) => !isVoucherKey(p.key) || !NOT_YET_SELLABLE[p.key]);
  const anyTierOn = vouchers.some((p) => settings[p.key]);

  const voucherRow = ({ key, name, line, value, tone, icon }: Product) => {
    const on = settings[key] && prepaymentsOn;
    const reason = isVoucherKey(key) ? state.unavailable[key] : undefined;
    const blocked = !takesCards ? needsStripe : !prepaymentsOn ? needsPrepayments : !on && !settings.loyalty_cards ? creditsBlock : null;
    const note = on && reason && NOT_SELLING[reason] ? NOT_SELLING[reason] : null;
    return (
      <li key={key} className={MARK_ROW} data-place-state={key}>
        {mark(icon, on, tone)}
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{line}</p>
          {under(blocked, note)}
        </div>
        <p className={cn("font-semibold whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{value}</p>
        <Switch on={on} pending={pending || !!blocked} onClick={() => void flip(key, !on)} label={`${name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  const storyOn = cashback.story_reward_cents > 0;
  // A story pays only while the Credits Account is on (story_reward_grant).
  const storyLive = settings.loyalty_cards && storyOn;

  return (
    <>
      {testMode ? <TestBand className="w-fit" detail="Stripe sandbox: guests pay with Stripe's test cards, no real money moves." /> : null}
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

      {/* CREDIT LIMIT (MESITA-4732): how much credit guests may hold here,
          and the next step that raises it. Older servers send nothing: no box. */}
      {creditLimit ? (
        <div id="credit-limit" className="scroll-mt-24">
          <Card className={SECTION}>
            {head(GaugeIcon, "Credit Limit")}
            <ul className="divide-border divide-y">
              <li className={MARK_ROW} data-place-state="credit_limit">
                {mark(GaugeIcon, (creditLimit.limit_cents ?? 0) > 0, "bg-emerald-100 text-emerald-700")}
                <div className="min-w-0">
                  <p className="font-medium">Outstanding Credit</p>
                  <p className="text-muted-foreground">{limitLine(creditLimit)}</p>
                  {creditLimit.next ? (
                    <p className={BLOCKED}>
                      {creditLimit.next.step === "credits"
                        ? step(`Enable Credits Account → ${wholeMoney(creditLimit.next.limit_cents, creditLimit.currency)}`, "#credits-account")
                        : step(`Connect Stripe Account → ${wholeMoney(creditLimit.next.limit_cents, creditLimit.currency)}`, "#stripe-account")}
                    </p>
                  ) : null}
                </div>
                <p className="font-semibold whitespace-nowrap tabular-nums">
                  {wholeMoney(creditLimit.outstanding_cents, creditLimit.currency)}
                  <span className="text-muted-foreground font-normal">
                    {creditLimit.limit_cents === null ? " · no new credit" : ` of ${wholeMoney(creditLimit.limit_cents, creditLimit.currency)}`}
                  </span>
                </p>
                <span />
              </li>
            </ul>
          </Card>
        </div>
      ) : null}

      <div id="credits-account" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(WalletIcon, "Credits Account")}
          <ul className="divide-border divide-y">
            <li id="loyalty-cards-agreement" className={MARK_ROW} data-place-state="loyalty_cards_contract">
              {mark(SignatureIcon, contract.signed, "bg-emerald-100 text-emerald-700")}
              <div className="min-w-0">
                <p className="font-medium">Credits Agreement</p>
                <p className="text-muted-foreground">Your agreement with Mesita to run credits here. Separate from Stripe.</p>
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !contract.signed && "text-muted-foreground")}>{contract.signed ? signedOn(contract) : "Not signed"}</p>
              {contract.signed ? (
                <span />
              ) : (
                <button type="button" className={cn(PILL_BUTTON_CLASS, "shrink-0")} disabled={pending} onClick={() => setAgreeing(true)}>
                  Agree
                </button>
              )}
            </li>
            {/* CREDITS BALANCE (MESITA-3946): what guests hold here now,
                Available + Pending, in the one currency. Read-only. */}
            <li id="credits-balance" className={MARK_ROW} data-place-state="credits_balance">
              {mark(PiggyBankIcon, true, "bg-emerald-100 text-emerald-700")}
              <div className="min-w-0">
                <p className="font-medium">Credits Balance</p>
                <p className="text-muted-foreground">
                  What guests hold here now: your debt, in {CURRENCY_NAME[currency] ?? currency}, always honoured.
                  {balance && balance.pending_cents > 0 ? ` ${moneyLabel(balance.pending_cents, currency)} of it is still pending.` : ""}
                </p>
              </div>
              <p className={cn("font-semibold whitespace-nowrap tabular-nums", !balance && "text-muted-foreground")}>
                {balance ? moneyLabel(balance.available_cents + balance.pending_cents, currency) : "—"}
              </p>
              <span />
            </li>
            {/* ACCEPT CREDITS PAYMENTS CAN'T TURN DOWN (MESITA-3946): the
                Loyalty Cards switch, on once the agreement is signed and then
                locked; a guest's credit is always honoured. */}
            <li id="loyalty-cards" className={MARK_ROW} data-place-state="loyalty_cards">
              {mark(WalletIcon, settings.loyalty_cards, "bg-emerald-100 text-emerald-700")}
              <div className="min-w-0">
                <p className="font-medium">Accept Credits Payments</p>
                <p className="text-muted-foreground">Guests earn credit here and pay with it. Once on, it stays on.</p>
                {under(settings.loyalty_cards || contract.signed ? undefined : needsContract, null)}
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !settings.loyalty_cards && "text-muted-foreground")}>{settings.loyalty_cards ? "Always on" : "Off"}</p>
              <Switch
                on={settings.loyalty_cards}
                pending={pending || settings.loyalty_cards || !contract.signed}
                onClick={() => void flip("loyalty_cards", true)}
                label={`Accept Credits Payments: ${settings.loyalty_cards ? "always on" : "off"}`}
              />
            </li>
          </ul>
        </Card>
      </div>

      <div id="stripe-account" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(StripeLogoIcon, "Stripe Account")}
          <ul className="divide-border divide-y">
            <li className={MARK_ROW} data-place-state="stripe">
              {mark(StripeLogoIcon, ready, "bg-indigo-100 text-indigo-700")}
              <div className="min-w-0">
                <p className="font-medium">Stripe Account</p>
                <p className="text-muted-foreground">
                  {ready
                    ? ["Managed by Stripe", account.country ? COUNTRY[account.country] ?? account.country : null, testMode ? "Sandbox" : "Live", copy.line].filter(Boolean).join(" · ")
                    : `${copy.line}${testMode ? " Sandbox." : ""}`}
                </p>
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !ready && "text-muted-foreground")}>{STAGE_LABEL[stage]}</p>
              {copy.button ? (
                <button
                  type="button"
                  // Standard pill size (MESITA-4534): Stripe's purple while
                  // setup is unfinished, a quiet grey link once connected.
                  className={cn(
                    PILL_BUTTON_CLASS,
                    "shrink-0 whitespace-nowrap",
                    ready ? QUIET_PILL_CLASS : "bg-[#635BFF] text-white hover:bg-[#5249e6] hover:opacity-100",
                  )}
                  disabled={pending}
                  onClick={() => void stripe()}
                >
                  {busy === "stripe" ? "Opening…" : copy.button}
                  {ready && busy !== "stripe" ? <ArrowSquareOutIcon size={14} weight="bold" aria-hidden /> : null}
                </button>
              ) : (
                <span />
              )}
            </li>
          </ul>
        </Card>
      </div>

      {/* VISIT CHECKOUT (MESITA-4732): how a guest pays the bill at the visit,
          and the cashback it earns. Mesita Credits has no switch: a guest's
          credit is the place's debt, always honoured. */}
      <div id="visit-checkout" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(ReceiptIcon, "Visit Checkout")}
          <ul className="divide-border divide-y">
            {pairRow({
              id: "cash-payments",
              name: "Accept Cash Payments",
              line: settings.cash_payments
                ? "Open cash amounts appear below. Mark each one received when you have the cash."
                : "Guests can't pay cash at this place until this is on.",
              icon: MoneyIcon,
              tone: "bg-lime-100 text-lime-700",
              accept: { key: "cash_payments" },
            })}
            {pairRow({
              id: "credits-payments",
              name: "Mesita Credits",
              line: "The credit a guest holds here, applied first. Never on the tip.",
              icon: WalletIcon,
              tone: "bg-emerald-100 text-emerald-700",
              accept: "always",
            })}
            {RATE_ROWS.map((row) => {
              const on = settings.loyalty_cards && cashback[row.key] > 0;
              return (
                <li key={row.key} id={row.key === "welcome_bps" ? "welcome-visit-rate" : "returning-visit-rate"} className={MARK_ROW} data-place-state={row.key}>
                  {mark(row.icon, on, "bg-green-100 text-green-700")}
                  <div className="min-w-0">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-muted-foreground">{row.line}</p>
                    {under(creditsBlock, null)}
                  </div>
                  <p className={cn("font-semibold whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{pct(cashback[row.key])}</p>
                  <select
                    className={SELECT}
                    aria-label={row.name}
                    value={cashback[row.key]}
                    disabled={pending}
                    onChange={(e) => void saveRates({ ...cashback, [row.key]: Number(e.target.value) })}
                  >
                    {CASHBACK_STEPS_BPS.map((bps) => (
                      <option key={bps} value={bps}>
                        {pct(bps)}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          {cashDue.length > 0 ? (
            <ul className="divide-border border-border divide-y border-t" data-cash-due>
              {cashDue.map((row) => (
                <li key={row.attempt_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                  <span>
                    <span className="font-semibold">{moneyLabel(row.cash_cents, currency)}</span>
                    <span className="text-muted-foreground"> · {row.guest_label} · {new Date(row.created_at).toLocaleString()}</span>
                  </span>
                  <button
                    type="button"
                    className={PILL_BUTTON_CLASS}
                    onClick={() => {
                      const amount = moneyLabel(row.cash_cents, currency);
                      if (!window.confirm(`Mark ${amount} received?`)) return;
                      void receiveGuestCash(placeId, row.attempt_id, row.cash_cents).then((r) => {
                        if (!r.ok) return setError(r.code === "amount_changed" ? "Amount changed. Refresh this list." : r.error);
                        setCashDue((rows) => rows.filter((x) => x.attempt_id !== row.attempt_id));
                      });
                    }}
                  >
                    Received
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className={cn(NOTE, "px-5 pb-4 sm:px-6")} data-waiter-charge>
            A confirmed bill earns cashback on the part not paid with credit, never the tip, 3 hours later. Waiter&apos;s screen:{" "}
            <a className="underline" href={chargeUrl} target="_blank" rel="noreferrer">
              {chargeUrl.replace("https://", "")}
            </a>
            {" · "}Staff list:{" "}
            <a className="underline" href={staffListUrl} target="_blank" rel="noreferrer">
              {staffListUrl.replace("https://", "")}
            </a>
          </p>
        </Card>
      </div>

      {/* PREPAID VOUCHERS (MESITA-4732): ONE master switch, Accept Prepayments,
          over the tiers. It stands for `prepayments` and the old Accept Stripe
          Payments (`stripe_payments`) gate, which no longer has a row. */}
      <div id="prepaid-vouchers" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(TicketIcon, "Prepaid Vouchers")}
          <ul className="divide-border divide-y" data-place-state="vouchers">
            <li id="accept-prepayments" className={MARK_ROW} data-place-state="prepayments">
              {mark(CreditCardIcon, prepaymentsOn, "bg-teal-100 text-teal-700")}
              <div className="min-w-0">
                <p className="font-medium">Accept Prepayments</p>
                <p className="text-muted-foreground">Guests pay by card through your Stripe Account</p>
                {under(
                  prepaymentsBlocked,
                  prepaymentsOn && fee.hold ? "Off until Mesita's invoice is paid." : `${per100(currency)} You get the money now; the bonus lands 3 hours later.`,
                )}
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !prepaymentsOn && "text-muted-foreground")}>{prepaymentsOn ? "On" : "Off"}</p>
              <Switch
                on={prepaymentsOn}
                pending={pending || !!prepaymentsBlocked}
                onClick={() => void flipPrepayments(!prepaymentsOn)}
                label={`Accept Prepayments: ${prepaymentsOn ? "on" : "off"}`}
              />
            </li>
            {/* Small, Medium, Big; what money-state's NOT_YET_SELLABLE lists is off sale. */}
            {vouchers.map(voucherRow)}
          </ul>
          {!anyTierOn ? <p className={cn(NOTE, "px-5 pb-4 sm:px-6")}>No vouchers available</p> : null}
        </Card>
      </div>

      {/* INSTAGRAM STORIES (MESITA-4714; a box since MESITA-4732): what a
          verified story tagging @mesita and this place pays the guest, as
          credit here 3 hours later, once per guest every 7 days. The handle
          is the Profile's, read-only here. */}
      <div id="instagram-stories" className="scroll-mt-24">
        <Card className={SECTION}>
          {head(InstagramLogoIcon, "Instagram Stories")}
          <ul className="divide-border divide-y">
            <li id="story-rewards" className={MARK_ROW} data-place-state="story_reward">
              {mark(InstagramLogoIcon, storyLive, "bg-pink-100 text-pink-700")}
              <div className="min-w-0">
                <p className="font-medium">Enable Story Rewards</p>
                <p className="text-muted-foreground">Credit for a guest&apos;s story tagging this place, once every 7 days.</p>
                {under(creditsBlock, null)}
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !storyLive && "text-muted-foreground")}>{storyLive ? "On" : "Off"}</p>
              <Switch
                on={storyLive}
                pending={pending || !!creditsBlock}
                onClick={() => void saveRates({ ...cashback, story_reward_cents: storyOn ? 0 : lastStory })}
                label={`Enable Story Rewards: ${storyLive ? "on" : "off"}`}
              />
            </li>
            <li className={MARK_ROW} data-place-state="place_username">
              {mark(InstagramLogoIcon, instagramUrl !== null, "bg-pink-100 text-pink-700")}
              <div className="min-w-0">
                <p className="font-medium">Place Username</p>
                <p className="text-muted-foreground">Guests must tag this account and @mesita</p>
              </div>
              <p className={cn("font-semibold whitespace-nowrap", !instagramUrl && "text-muted-foreground")}>{instagramUrl ? instagramHandle(instagramUrl) : "Not set"}</p>
              <a className={cn(PILL_BUTTON_CLASS, QUIET_PILL_CLASS, "shrink-0 whitespace-nowrap")} href={placeTabHref(placeId, "profile")}>
                Edit on Profile
              </a>
            </li>
            <li className={MARK_ROW} data-place-state="story_credit">
              {mark(PiggyBankIcon, storyLive, "bg-pink-100 text-pink-700")}
              <div className="min-w-0">
                <p className="font-medium">Story Credit</p>
                <p className="text-muted-foreground">What one verified story pays the guest.</p>
              </div>
              <span />
              <div className="flex gap-1" role="group" aria-label="Story Credit">
                {STORY_AMOUNTS.map((cents) => {
                  const picked = (storyOn ? cashback.story_reward_cents : lastStory) === cents;
                  return (
                    <button
                      key={cents}
                      type="button"
                      aria-pressed={picked}
                      disabled={pending || !storyOn}
                      onClick={() => void saveRates({ ...cashback, story_reward_cents: cents })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums disabled:opacity-50",
                        picked ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground",
                      )}
                    >
                      {wholeMoney(cents, currency)}
                    </button>
                  );
                })}
              </div>
            </li>
          </ul>
        </Card>
      </div>

      {agreeing ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onClick={() => !pending && setAgreeing(false)}>
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
              <button type="button" className={cn(PILL_BUTTON_CLASS, QUIET_PILL_CLASS)} disabled={busy === "contract"} onClick={() => setAgreeing(false)}>
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
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change offers.</p> : null}
    </>
  );
}
