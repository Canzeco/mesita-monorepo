"use client";

// Payments (MESITA-3296; the Place states of Main §10 since MESITA-3589).
// Configuration only (MESITA-3596, Pato: "in payments its just to configure"):
// the owner's money and its log live on Operations › Money, and there is no
// table QR (the guest shows the QR). One list again (MESITA-3600, Pato on the
// card grid: "make the list UI again. that looks like shit and its
// confusing"): the test pill, an unpaid fee banner (MESITA-3461), the
// numbered to-do strip (Agreement → House Credits → Waiter code → Stripe
// Account, MESITA-3602), then section cards of rows, each row a mark, a title and one line, its value and
// its control:
//   (MESITA-3827, Pato: "Main Configuration · Cash Payments · Credits
//   Payments · Mesita Payments · Mesita Prepayments", each way to pay with its
//   own Cashback-as-Credits:)
//   Main Configuration · the Stripe Account row and its button, then the
//     House Credits Agreement and the House Credits switch it unlocks;
//   Cash Payments · Cash Payments, then its Cashback-as-Credits (Off or 3%, MESITA-3944);
//   Credits Payments · Credits Payments (Always on), then its Cashback-as-
//     Credits (Off or 5%, on the credit part; MESITA-3944);
//   Mesita Payments · Mesita Payments, then its Cashback-as-Credits (Off or 5%);
//   Mesita Prepayments · Mesita Prepayments, its Cashback-as-Credits (Off or
//     5% of a voucher's price), then one row per voucher;
//   Waiter Code · its own section, last (MESITA-3824; inside Cash Payments
//     from MESITA-3625, moved from Settings by MESITA-3600): waiters sign
//     any payment's QR with it, cash or card;
//   (Credits Payments, one row, Always on, sits last in House Credits:
//     MESITA-3703, Pato: "Add field call it Credits Payments to maintain
//     symmetry", then MESITA-3704: "credits payments must go in the House
//     Credits section". Guests pay with the credit they hold here. No
//     switch: a guest's credit is the place's debt, always honoured; House
//     Credits Off stops new credit only.)
// A switch that can't turn on is disabled and its row says the one missing
// step, with a link to it. Never "Mesita Pay" (Pato, 2026-11-10).
// The House Credits Agreement is independent of Stripe (Pato, 2026-11-09):
// signing opens a plain Agree dialog whose text is a placeholder until a
// lawyer writes it. A guest's credit is the place's debt: House Credits Off
// stops new credit, never what guests hold. The owner and Mesita staff change
// these; the server refuses anyone else and repeats each rule.

import { useState } from "react";
import { CARD_BILL_PAY_LIVE, moneyState, NOT_YET_SELLABLE, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  CheckIcon,
  CoinsIcon,
  ConfettiIcon,
  CrownIcon,
  CurrencyCircleDollarIcon,
  DeviceMobileIcon,
  InstagramLogoIcon,
  MoneyIcon,
  PiggyBankIcon,
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
import { moneyLabel } from "@mesita/place-profile/lib/money";
import {
  openPaymentDashboard,
  type HouseCreditsContract,
  type PaymentAccount,
  type PaymentKey,
  type PaymentRateKey,
  type PlacePayments,
  type StripeStage,
  setPlacePayment,
  setPlacePaymentRate,
  signHouseCreditsContract,
  startPaymentOnboarding,
} from "@/lib/business-api";
import { WaiterCodeRow } from "./WaiterCode";

/** One row: mark · title and line · value · control; the line wraps, the rest hold. */
const MARK_ROW = "grid min-h-16 scroll-mt-24 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";
const HEAD = "px-5 pt-4 pb-2 font-semibold sm:px-6";
const NOTE = "text-muted-foreground text-xs";
const BLOCKED = "text-xs text-amber-800 dark:text-amber-300";
const SECTION = "flex flex-col p-0 sm:p-0";

/** A voucher: its bonus in its own colour (MESITA-3298) and one objective line. */
/** A voucher: its bonus, one objective line, and the Offers page's face
 *  (Pato, MESITA-3839: "change the colors and icons of the prepayments"):
 *  the guest and the owner see the same colour and mark. */
type Product = { key: PaymentKey; name: string; line: string; value: string; tone: string; icon: Icon };

// PRICED IN THE PLACE'S CURRENCY (MESITA-3914, Pato: "100 MX 10% · 1000 MX
// 20% · 10 USD 10% · 100 USD 20% ... all small must start with 1 and big be
// 10X that"). TWIN of VOUCHER_PRICE_CENTS in _shared/money.ts.
// The Small price per currency, in whole units (MESITA-3943: the three); Big
// 10×, Biggest 50×, Welcome · Story · VIP at the Small price. TWIN of
// VOUCHER_CURRENCY_LIST in _shared/money.ts.
const SMALL: Record<string, number> = { MXN: 100, USD: 10, CAD: 10 };
const TIMES: Record<VoucherKey, number> = { voucher_200: 1, voucher_1000: 10, voucher_5000: 50, voucher_welcome: 1, voucher_story: 1, voucher_vip: 1 };
const VOUCHER_PRICE: Record<string, Record<VoucherKey, number>> = Object.fromEntries(
  Object.entries(SMALL).map(([c, small]) => [
    c,
    Object.fromEntries(Object.entries(TIMES).map(([k, n]) => [k, small * 100 * n])) as Record<VoucherKey, number>,
  ]),
);

/** A voucher row before its price: the bonus in bps and what follows the deal. */
type VoucherSeed = Omit<Product, "line" | "key"> & { key: VoucherKey; bps: number; tail?: string };

const STANDARD: VoucherSeed[] = [
  { key: "voucher_200", name: "Small Voucher", bps: 1000, value: "+10%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_1000", name: "Big Voucher", bps: 2000, value: "+20%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
  { key: "voucher_5000", name: "Biggest Voucher", bps: 3000, value: "+30%", tone: "bg-green-100 text-green-700", icon: TicketIcon },
];

const SPECIAL: VoucherSeed[] = [
  { key: "voucher_welcome", name: "Welcome Voucher", bps: 10000, tail: "One per guest at your place.", value: "+100%", tone: "bg-blue-100 text-blue-700", icon: ConfettiIcon },
  { key: "voucher_story", name: "Story Voucher", bps: 3000, tail: "After posting an Instagram story at your place.", value: "+30%", tone: "bg-pink-100 text-pink-700", icon: InstagramLogoIcon },
  { key: "voucher_vip", name: "VIP Voucher", bps: 10000, tail: "VIP guests only.", value: "+100%", tone: "bg-amber-100 text-amber-700", icon: CrownIcon },
];

/** The voucher rows in the place's currency; none where vouchers aren't sold. */
function voucherProducts(currency: string): Product[] {
  const prices = VOUCHER_PRICE[currency];
  if (!prices) return [];
  return [...SPECIAL.slice(0, 1), ...STANDARD, ...SPECIAL.slice(1)].map(({ bps, tail, ...p }) => {
    const price = prices[p.key];
    const credit = price + Math.floor((price * bps) / 10000);
    return { ...p, line: `Guest pays ${moneyLabel(price, currency)}, gets ${moneyLabel(credit, currency)} of credit.${tail ? ` ${tail}` : ""}` };
  });
}

/** What a card payment costs the place (MESITA-3461; the 5% fee is billed
 *  apart), in the place's currency (MESITA-3913). */
const per100 = (currency: string) =>
  `Per ${moneyLabel(100_00, currency)} by card: Stripe's card fee + ${moneyLabel(5_00, currency)} to Mesita.`;

/** The currency's name in the plural, for the Credits Currency row (MESITA-3913). */
const CURRENCY_NAME: Record<string, string> = {
  MXN: "Mexican pesos", USD: "US dollars", CAD: "Canadian dollars", EUR: "euros", GBP: "pounds sterling",
  BRL: "Brazilian reais", COP: "Colombian pesos", CLP: "Chilean pesos", PEN: "Peruvian soles", JPY: "Japanese yen",
};
const ARRIVES_SOON = "Card payment of the bill arrives soon.";

/** The waiter's charge (MESITA-3306) and the staff list (MESITA-3462). */
const VISIT_ORIGIN = "https://visit.mesita.ai";

type VoucherKey = Extract<PaymentKey, `voucher_${string}`>;
const isVoucherKey = (k: PaymentKey): k is VoucherKey => k.startsWith("voucher_");

/** Why a switched-on voucher is not for sale yet (MESITA-3303). */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until the Stripe Account takes cards.",
  needs_house_credits: "Not for sale until House Credits is on.",
  needs_billing: "Not for sale until Mesita's invoice is paid.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

/** Each cashback's one rate (Main §10, MESITA-3596): Off or this. The server takes nothing else. */
const CASHBACK_BPS: Record<PaymentRateKey, number> = {
  card_cashback_bps: 500,
  cash_cashback_bps: 300,
  // MESITA-3827: Credits Payments and Mesita Prepayments Cashback.
  credit_cashback_bps: 500,
  prepay_cashback_bps: 500,
};
const pct = (bps: number) => `${bps / 100}%`;

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
      return { line: "Your own account, where App Payments and App Prepayments land. Not needed for House Credits or cash.", button: "Connect Stripe", open: false };
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

function signedOn(c: HouseCreditsContract): string {
  if (!c.signed_at) return "Signed";
  const d = new Date(c.signed_at);
  return `Signed ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
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
  const currency = initial.currency ?? "MXN";
  const [contract, setContract] = useState<HouseCreditsContract>(initial.contract ?? { signed: false, signed_at: null, terms_version: null });
  const [agreeing, setAgreeing] = useState(false);
  const [busy, setBusy] = useState<PaymentKey | PaymentRateKey | "stripe" | "contract" | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode, code_set: codeSetAtLoad, fee } = initial;
  // The Waiter code row sets it here, so Cash Payments unlocks without a reload.
  const [codeSet, setCodeSet] = useState(codeSetAtLoad);
  const chargeUrl = `${VISIT_ORIGIN}/charge/${encodeURIComponent(placeId)}`;
  const staffListUrl = `${VISIT_ORIGIN}/payments/${encodeURIComponent(placeId)}`;
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const stage: StripeStage = account.stage ?? (ready ? "connected" : account.state === "none" ? "none" : "onboarding");
  const pending = !canEdit || busy !== null;
  // Mesita Payments, its cashback, Mesita Prepayments and every voucher need
  // the Stripe Account to take cards in the server's mode (MESITA-3599; the
  // set EF and SQL refuse otherwise): until then they read Off and cannot be
  // switched.
  const takesCards = account.charges_enabled && account.livemode === !testMode;
  // The same rule the server sells and pays by (money-state, one source).
  const state = moneyState({ ...settings, has_place_code: codeSet }, { charges_enabled: account.charges_enabled, fee_hold: fee.hold }, null);

  async function flip(key: PaymentKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    const r = await setPlacePayment(placeId, key, enabled);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
  }

  async function rate(key: PaymentRateKey, bps: number | null) {
    setBusy(key);
    setError(null);
    const r = await setPlacePaymentRate(placeId, key, bps);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
  }

  async function agree() {
    setBusy("contract");
    setError(null);
    const r = await signHouseCreditsContract(placeId);
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

  /** The one missing step, linked to the row (or page) that does it. */
  const step = (text: string, href: string) => (
    <a className="underline underline-offset-2" href={href}>
      {text}
    </a>
  );
  const needsContract = step("Sign the House Credits Agreement first.", "#house-credits-agreement");
  const needsHouseCredits = step("Turn House Credits on first.", "#house-credits");
  const needsStripe = step("Connect the Stripe Account first.", "#stripe-account");
  const needsCode = step("Set the waiter code first.", "#waiter-code");
  const needsPrepayments = step("Turn App Prepayments on first.", "#mesita-prepayments");
  const needsCash = step("Turn Cash Payments on first.", "#cash-payments");

  // The to-do strip (MESITA-3602, Pato: "a sequential horizontal to-do list to
  // fully enable Payments"): four steps in order, each a link to its row; the
  // first not done is the next one, highlighted.
  const steps = [
    { name: "Agreement", done: contract.signed, href: "#house-credits-agreement" },
    { name: "House Credits", done: settings.house_credits, href: "#house-credits" },
    { name: "Waiter code", done: codeSet, href: "#waiter-code" },
    { name: "Stripe Account", done: takesCards, href: "#stripe-account" },
  ];
  const next = steps.findIndex((s) => !s.done);

  /** A row's one line under its title: the missing step if blocked, else its note. */
  const under = (blocked: React.ReactNode, note: React.ReactNode) =>
    blocked ? <p className={BLOCKED}>{blocked}</p> : note ? <p className={NOTE}>{note}</p> : null;

  /** One on/off state: its value, its switch, and the step that unlocks it. */
  const switchRow = (args: {
    key: PaymentKey;
    id: string;
    name: string;
    line: string;
    icon: Icon;
    tone: string;
    /** Why it can't turn on yet; the switch stays off and disabled. */
    blocked?: React.ReactNode;
    note?: React.ReactNode;
    /** Needs the Stripe Account to take cards: Off and disabled until it does. */
    stripe?: boolean;
  }) => {
    const gated = args.stripe === true && !takesCards;
    const on = settings[args.key] && !gated;
    const blocked = gated ? needsStripe : !on && args.blocked;
    return (
      <li key={args.key} id={args.id} className={MARK_ROW} data-place-state={args.key}>
        {mark(args.icon, on, args.tone)}
        <div className="min-w-0">
          <p className="font-medium">{args.name}</p>
          <p className="text-muted-foreground">{args.line}</p>
          {under(blocked, args.note)}
        </div>
        <p className={cn("font-semibold whitespace-nowrap", !on && "text-muted-foreground")}>{on ? "On" : "Off"}</p>
        <Switch on={on} pending={pending || !!blocked} onClick={() => void flip(args.key, !on)} label={`${args.name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  /** One Cashback-as-Credits: a switch between Off and its one rate. */
  const rateRow = (args: { key: PaymentRateKey; name: string; line: string; blocked?: React.ReactNode; note?: React.ReactNode; stripe?: boolean }) => {
    const gated = args.stripe === true && !takesCards;
    const value = gated ? null : settings[args.key];
    const on = value !== null;
    const blocked = gated ? needsStripe : args.blocked;
    const fixed = pct(CASHBACK_BPS[args.key]);
    return (
      <li key={args.key} className={MARK_ROW} data-place-state={args.key}>
        {mark(CoinsIcon, on && !blocked, "bg-amber-100 text-amber-700")}
        <div className="min-w-0">
          <p className="font-medium">Cashback-as-Credits</p>
          <p className="text-muted-foreground">{args.line}</p>
          {under(blocked, args.note)}
        </div>
        <p className={cn("font-semibold whitespace-nowrap tabular-nums", (!on || blocked) && "text-muted-foreground")}>{on ? pct(value) : `Off · ${fixed}`}</p>
        <Switch
          on={on}
          pending={pending || gated || (!on && !!blocked)}
          onClick={() => void rate(args.key, on ? null : CASHBACK_BPS[args.key])}
          label={`${args.name}: ${on ? fixed : "off"}`}
        />
      </li>
    );
  };

  const voucherRow = ({ key, name, line, value, tone, icon }: Product) => {
    const on = settings[key] && takesCards;
    const reason = isVoucherKey(key) ? state.unavailable[key] : undefined;
    const blocked = !takesCards ? needsStripe : !on && !settings.house_credits ? needsHouseCredits : null;
    const note = on
      ? settings.prepayments
        ? reason && NOT_SELLING[reason]
          ? NOT_SELLING[reason]
          : null
        : needsPrepayments
      : null;
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
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="To fully enable Payments" data-setup-steps>
        {steps.map((s, n) => (
          <li key={s.href} className="flex items-center gap-2">
            {n > 0 ? <CaretRightIcon size={14} weight="bold" className="text-muted-foreground shrink-0" aria-hidden /> : null}
            <a
              href={s.href}
              aria-current={n === next ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 font-medium whitespace-nowrap transition-colors",
                n === next ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
                s.done && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                  s.done ? "bg-emerald-500 text-white" : n === next ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <CheckIcon size={13} weight="bold" aria-hidden /> : n + 1}
              </span>
              {s.name}
              <span className="sr-only">{s.done ? ": done" : n === next ? ": next" : ": to do"}</span>
            </a>
          </li>
        ))}
      </ol>
      {/* MAIN CONFIGURATION (Pato, 2026-11-13, MESITA-3827: "Main
          Configuration · Stripe Account · Credits Agreement"): the account,
          then the agreement and the House Credits switch it unlocks. */}
      <Card className={SECTION}>
        <h2 className={HEAD}>Main Configuration</h2>
        <ul className="divide-border divide-y">
          <li id="stripe-account" className={MARK_ROW} data-place-state="stripe">
            {mark(StripeLogoIcon, ready, "bg-indigo-100 text-indigo-700")}
            <div className="min-w-0">
              <p className="font-medium">Stripe Account</p>
              <p className="text-muted-foreground">
                {ready
                  ? [account.country ? COUNTRY[account.country] ?? account.country : null, testMode ? "Sandbox" : "Live", copy.line].filter(Boolean).join(" · ")
                  : `${copy.line}${testMode ? " Sandbox." : ""}`}
              </p>
            </div>
            <p className={cn("font-semibold whitespace-nowrap", !ready && "text-muted-foreground")}>{STAGE_LABEL[stage]}</p>
            <span />
          </li>
        </ul>
        {/* THE STRIPE BUTTON IS BIG (Pato, MESITA-3639: "Open Stripe button
            must be big"): full width under the row, Stripe's own purple. */}
        {copy.button ? (
          <div className="px-5 pb-5 sm:px-6">
            <button
              type="button"
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#635BFF] text-base font-semibold text-white transition hover:bg-[#5249e6] disabled:opacity-60"
              disabled={pending}
              onClick={() => void stripe()}
            >
              {busy === "stripe" ? "Opening…" : copy.button}
              {ready && busy !== "stripe" ? <ArrowSquareOutIcon size={20} weight="bold" aria-hidden /> : null}
            </button>
          </div>
        ) : null}
        <ul className="divide-border border-border divide-y border-t">
          <li id="house-credits-agreement" className={MARK_ROW} data-place-state="house_credits_contract">
            {mark(SignatureIcon, contract.signed, "bg-emerald-100 text-emerald-700")}
            <div className="min-w-0">
              <p className="font-medium">House Credits Agreement</p>
              <p className="text-muted-foreground">Your agreement with Mesita to run House Credits. Separate from Stripe.</p>
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
          {switchRow({
            key: "house_credits",
            id: "house-credits",
            name: "House Credits",
            line: `Guests earn and buy credit to spend here. It is your debt, in ${currency}, always honoured.`,
            icon: PiggyBankIcon,
            tone: "bg-emerald-100 text-emerald-700",
            blocked: contract.signed ? undefined : needsContract,
            note: settings.house_credits ? null : "Off: no new credit. Guests still spend what they already hold.",
          })}
        </ul>
      </Card>
      {/* FIVE SECTIONS, APP FIRST (Pato, 2026-11-13, MESITA-3838): App
          Payments, Cash Payments, Credits Payments, App Prepayments, Waiter
          Code; each payment section is its switch, then its
          Cashback-as-Credits. */}
      <Card className={SECTION}>
        <h2 className={HEAD}>App Payments</h2>
        <ul className="divide-border divide-y">
          {switchRow({
            key: "pay_cards",
            id: "mesita-payments",
            name: "App Payments",
            line: "Guests pay the bill by card inside the app.",
            icon: DeviceMobileIcon,
            tone: "bg-sky-100 text-sky-700",
            stripe: true,
            note: settings.pay_cards
              ? fee.hold
                  ? "Off until Mesita's invoice is paid."
                  : !CARD_BILL_PAY_LIVE
                    ? ARRIVES_SOON
                    : per100(currency)
              : "Guests still pay from credit here.",
          })}
          {rateRow({
            key: "card_cashback_bps",
            name: "App Payments Cashback-as-Credits",
            line: "Back as credit here on the card part of the bill. Never on the tip.",
            blocked: !settings.house_credits ? needsHouseCredits : undefined,
            stripe: true,
            note: settings.card_cashback_bps !== null && !state.cashback && settings.house_credits ? "Starts once App Payments takes cards." : null,
          })}
        </ul>
      </Card>
      <Card className={SECTION}>
        <h2 className={HEAD}>Cash Payments</h2>
        <ul className="divide-border divide-y">
          {switchRow({
            key: "cash_payments",
            id: "cash-payments",
            name: "Cash Payments",
            line: "Guests pay cash or your terminal; your waiter taps Received on visit.mesita.ai.",
            icon: MoneyIcon,
            tone: "bg-lime-100 text-lime-700",
            blocked: codeSet ? undefined : needsCode,
          })}
          {/* OFF OR 3% (Pato, 2026-11-14, MESITA-3944: "CASHBACK AS CREDITS
              FOR CASH PAYMENTS IS FUCKING OFF OR 3"); None under MESITA-3928. */}
          {rateRow({
            key: "cash_cashback_bps",
            name: "Cash Payments Cashback-as-Credits",
            line: "Back as credit here on the bill, once your waiter taps Received. Never on the tip.",
            blocked: !settings.house_credits ? needsHouseCredits : !settings.cash_payments ? needsCash : undefined,
          })}
        </ul>
      </Card>
      {/* CREDITS PAYMENTS, ITS OWN SECTION WITH ITS CASHBACK (MESITA-3827,
          Pato: "add the option to give cashback with credits too"). */}
      <Card className={SECTION}>
        <h2 className={HEAD}>Credits Payments</h2>
        <ul className="divide-border divide-y">
          <li id="credits-payments" className={MARK_ROW} data-place-state="credits_payments">
            {mark(WalletIcon, true, "bg-emerald-100 text-emerald-700")}
            <div className="min-w-0">
              <p className="font-medium">Credits Payments</p>
              <p className="text-muted-foreground">Guests pay the bill with the credit they hold here. It is your debt, in {currency}, always honoured.</p>
            </div>
            <p className="font-semibold whitespace-nowrap">Always on</p>
            <span />
          </li>
          {/* OFF OR 5% (Pato, 2026-11-14, MESITA-3944: "enable Cashback as
              Credits for Credits Payments ... 5% Recycle that shit"); fixed
              at None under MESITA-3838. */}
          {rateRow({
            key: "credit_cashback_bps",
            name: "Credits Payments Cashback-as-Credits",
            line: "Back as credit here on the credit part of the bill. Never on the tip.",
            blocked: !settings.house_credits ? needsHouseCredits : undefined,
          })}
          {/* CREDITS CURRENCY (Pato, 2026-11-14, MESITA-3913: "one house
              credits card, one currency ... cannot be changed as in inferred
              based on the location of the place"): read-only. */}
          <li id="credits-currency" className={MARK_ROW} data-place-state="credits_currency">
            {mark(CurrencyCircleDollarIcon, true, "bg-emerald-100 text-emerald-700")}
            <div className="min-w-0">
              <p className="font-medium">Credits Currency</p>
              <p className="text-muted-foreground">
                Every credit here is in {CURRENCY_NAME[currency] ?? currency}. From your place&apos;s country, fixed when you sign the House Credits Agreement; it can&apos;t be changed. A guest paying with a card in another currency is converted by their bank.
              </p>
            </div>
            <p className="font-semibold whitespace-nowrap">{currency}</p>
            <span />
          </li>
        </ul>
      </Card>
      <Card className={SECTION}>
        <h2 className={HEAD}>App Prepayments</h2>
        <ul className="divide-border divide-y" data-place-state="vouchers">
          {switchRow({
            key: "prepayments",
            id: "mesita-prepayments",
            name: "App Prepayments",
            line: "Guests pay ahead by card and get extra credit. Several vouchers add up in one wallet and pay one bill together.",
            icon: TicketIcon,
            tone: "bg-emerald-100 text-emerald-700",
            blocked: !settings.house_credits ? needsHouseCredits : undefined,
            stripe: true,
            note: settings.prepayments
              ? fee.hold
                  ? "Off until Mesita's invoice is paid."
                  : state.sell.length === 0
                    ? "Switch on at least one voucher to sell."
                    : null
              : null,
          })}
          {/* 5% BACK ON A VOUCHER (Pato, MESITA-3928: "App Prepayment. 5%
              Fee. 5% Back to user"), off under MESITA-3836. */}
          {rateRow({
            key: "prepay_cashback_bps",
            name: "App Prepayments Cashback-as-Credits",
            line: "Back as credit here on a voucher's price, on top of its extra.",
            blocked: !settings.house_credits ? needsHouseCredits : !settings.prepayments ? needsPrepayments : undefined,
            stripe: true,
          })}
          {/* Welcome, Small, Big, VIP (MESITA-3834); the MX$5,000 voucher
              and Story are off sale, money-state's NOT_YET_SELLABLE. */}
          {voucherProducts(currency)
            .filter((p) => !isVoucherKey(p.key) || !NOT_YET_SELLABLE[p.key])
            .map(voucherRow)}
        </ul>
      </Card>
      {/* THE WAITER CODE IS ITS OWN SECTION, LAST (Pato, 2026-11-13,
          MESITA-3824: "waiter code is not inherent of that. waiter code is to
          sign qr. any qr, even digital payments. so separate them. waiter
          code must be at the bottom"). It sat inside Cash Payments from
          MESITA-3625. Cash Payments still waits for it. */}
      <Card className={SECTION}>
        <h2 className={HEAD}>Waiter Code</h2>
        <ul className="divide-border divide-y">
          <WaiterCodeRow placeId={placeId} isSet={codeSet} canEdit={canEdit} onSet={() => setCodeSet(true)} onError={setError} />
        </ul>
        {codeSet ? (
          <p className={cn(NOTE, "px-5 pb-4 sm:px-6")} data-waiter-charge>
            Waiter&apos;s screen:{" "}
            <a className="underline" href={chargeUrl} target="_blank" rel="noreferrer">
              {chargeUrl.replace("https://", "")}
            </a>
            {" · "}Staff list:{" "}
            <a className="underline" href={staffListUrl} target="_blank" rel="noreferrer">
              {staffListUrl.replace("https://", "")}
            </a>
          </p>
        ) : null}
      </Card>
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
              House Credits Agreement
            </h2>
            <p className="text-muted-foreground mt-2">{contract.text ?? "The full agreement will be added before launch."}</p>
            {/* MESITA-3923: the currency is agreed here, and fixed by the signature. */}
            <p className="mt-2 font-medium" data-agreement-currency>
              Your House Credits run in {currency} ({CURRENCY_NAME[currency] ?? currency}). Signing fixes it.
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
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change payments.</p> : null}
    </>
  );
}
