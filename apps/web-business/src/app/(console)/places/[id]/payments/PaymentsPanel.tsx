"use client";

// Payments (MESITA-3296; the Place states of Main §10 since MESITA-3589).
// Configuration only (MESITA-3596, Pato: "in payments its just to configure"):
// the owner's money and its log live on Operations › Money, and there is no
// table QR (the guest shows the QR). An unpaid fee invoice (MESITA-3461,
// Billing: Past due) shows a banner on top. Then one Stripe row (Place
// Stripe, seven values; the separate Connect card of MESITA-3384 folded into
// it), and the money states in Main §10's order:
//   House Credits Agreement · House Credits · Cash Payments · Cash Payments
//   Cashback · Mesita Payments · Mesita Payments Cashback · Mesita
//   Prepayments (the six vouchers).
// Each row says its value and, when it can't turn on yet, the one step that
// unlocks it. Each cashback is a switch with one rate (MESITA-3596: Cash
// Payments Off or 2%, Mesita Payments Off or 5%). The House Credits Agreement is independent of Stripe (Pato,
// 2026-11-09): signing opens a plain Agree dialog whose text is a placeholder
// until a lawyer writes it. A guest's credit is the place's debt: House
// Credits Off stops new credit, never what guests hold. The owner and Mesita
// staff change these; the server refuses anyone else and repeats each rule.

import { useState } from "react";
import { CARD_BILL_PAY_LIVE, moneyState, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  ClockIcon,
  CoinsIcon,
  DeviceMobileIcon,
  MoneyIcon,
  PiggyBankIcon,
  SignatureIcon,
  StripeLogoIcon,
  CrownIcon,
  WalletIcon,
  HandWavingIcon,
  InstagramLogoIcon,
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

// A row with a mark: tile, name and line, the value, the control.
const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";
const HEAD = "px-5 pt-4 pb-2 font-semibold sm:px-6";
const NOTE = "text-muted-foreground text-xs";

/** A voucher: its mark in its own colour (MESITA-3298) and one objective line. */
type Product = { key: PaymentKey; name: string; line: string; value: string; icon: Icon; tone: string };

const STANDARD: Product[] = [
  { key: "voucher_200", name: "Standard voucher", line: "Guest pays $200MX, gets $220MX of credit.", value: "+10%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "Standard Medium voucher", line: "Guest pays $1,000MX, gets $1,200MX of credit.", value: "+20%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_5000", name: "Standard Large voucher", line: "Guest pays $5,000MX, gets $6,500MX of credit.", value: "+30%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome voucher", line: "Guest pays $100MX, gets $130MX of credit. Once, on the first visit.", value: "+30%", icon: HandWavingIcon, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_story", name: "Story voucher", line: "Guest pays $100MX, gets $130MX of credit after posting an Instagram story at your place.", value: "+30%", icon: InstagramLogoIcon, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP voucher", line: "Guest pays $100MX, gets $130MX of credit. VIP guests only.", value: "+30%", icon: CrownIcon, tone: "bg-violet-100 text-violet-700" },
];

/** What a card payment costs the place (MESITA-3461; the 5% fee is billed apart). */
const PER_100 = "Per $100MX by card: Stripe's card fee + $5MX to Mesita.";
const ARRIVES_SOON = "Card payment of the bill arrives soon.";

/** The waiter's charge (MESITA-3306) and the staff list (MESITA-3462). */
const VISIT_ORIGIN = "https://visit.mesita.ai";

type VoucherKey = Extract<PaymentKey, `voucher_${string}`>;
const isVoucherKey = (k: PaymentKey): k is VoucherKey => k.startsWith("voucher_");

/** Why a switched-on voucher is not for sale yet (MESITA-3303). */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until Stripe setup is complete.",
  needs_house_credits: "Not for sale until House Credits is on.",
  needs_billing: "Not for sale until Mesita's invoice is paid.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

/** Each cashback's one rate (Main §10, MESITA-3596): Off or this. The server takes nothing else. */
const CASHBACK_BPS: Record<PaymentRateKey, number> = { card_cashback_bps: 500, cash_cashback_bps: 200 };
const pct = (bps: number) => `${bps / 100}%`;

/** Place Stripe's seven values, in the owner's words. */
const STAGE_LABEL: Record<StripeStage, string> = {
  none: "Not connected",
  onboarding: "Onboarding",
  in_review: "In review",
  connected: "Connected",
  action_needed: "Action needed",
  payouts_paused: "Payouts paused",
  restricted: "Restricted",
};

const COUNTRY: Record<string, string> = { MX: "Mexico", US: "United States" };

function accountChecks(a: PaymentAccount): { label: string; done: boolean }[] {
  return [
    { label: "Card payments", done: a.charges_enabled },
    { label: "Payouts to your bank", done: a.payouts_enabled },
    { label: "Details verified", done: a.details_submitted && a.requirements_due === 0 },
  ];
}

/** Open Stripe leaves the app, so it is the quiet grey button. */
const QUIET_PILL_CLASS = "bg-muted text-foreground hover:bg-muted/70 hover:opacity-100";

function accountCopy(a: PaymentAccount): { line: string; button: string | null; open: boolean } {
  switch (a.state) {
    case "none":
      return { line: "Card payments and vouchers land in your own Stripe account. House Credits and cash work without it.", button: "Connect Stripe", open: false };
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
  return `Signed on ${d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
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
  const [contract, setContract] = useState<HouseCreditsContract>(initial.contract ?? { signed: false, signed_at: null, terms_version: null });
  const [agreeing, setAgreeing] = useState(false);
  const [busy, setBusy] = useState<PaymentKey | PaymentRateKey | "stripe" | "contract" | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode, code_set: codeSet, fee } = initial;
  const chargeUrl = `${VISIT_ORIGIN}/charge/${encodeURIComponent(placeId)}`;
  const staffListUrl = `${VISIT_ORIGIN}/payments/${encodeURIComponent(placeId)}`;
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const stage: StripeStage = account.stage ?? (ready ? "connected" : account.state === "none" ? "none" : "onboarding");
  const pending = !canEdit || busy !== null;
  // Mesita Pay, its cashback and every voucher need Stripe to take cards in
  // the server's mode (MESITA-3599, the set EF and SQL refuse otherwise):
  // until then they read Off and cannot be switched.
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

  /** One on/off state: its value, its switch, and the step that unlocks it. */
  const switchRow = (args: {
    key: PaymentKey;
    name: string;
    line: string;
    icon: Icon;
    tone: string;
    /** Why it can't turn on yet; the switch stays off and disabled. */
    blocked?: React.ReactNode;
    note?: React.ReactNode;
    /** Needs Stripe to take cards: Off and disabled until it does. */
    stripe?: boolean;
  }) => {
    const gated = args.stripe === true && !takesCards;
    const on = settings[args.key] && !gated;
    const blocked = gated ? needsStripe : !on && args.blocked;
    return (
      <li key={args.key} className={MARK_ROW} data-place-state={args.key}>
        {mark(args.icon, on, args.tone)}
        <div className="min-w-0">
          <p className="font-medium">{args.name}</p>
          <p className="text-muted-foreground">{args.line}</p>
          {blocked ? <p className={NOTE}>{args.blocked}</p> : args.note ? <p className={NOTE}>{args.note}</p> : null}
        </div>
        <p className={cn("font-semibold whitespace-nowrap", !on && "text-muted-foreground")}>{on ? "On" : "Off"}</p>
        <Switch on={on} pending={pending || !!blocked} onClick={() => void flip(args.key, !on)} label={`${args.name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  /** One cashback: a switch between Off and its one rate. */
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
          <p className="font-medium">{args.name}</p>
          <p className="text-muted-foreground">{args.line}</p>
          {blocked ? <p className={NOTE}>{blocked}</p> : args.note ? <p className={NOTE}>{args.note}</p> : null}
        </div>
        <p className={cn("font-semibold whitespace-nowrap tabular-nums", (!on || blocked) && "text-muted-foreground")}>{on ? pct(value) : "Off"}</p>
        <Switch
          on={on}
          pending={pending || gated || (!on && !!blocked)}
          onClick={() => void rate(args.key, on ? null : CASHBACK_BPS[args.key])}
          label={`${args.name}: ${on ? fixed : "off"}`}
        />
      </li>
    );
  };

  const voucherRow = ({ key, name, line, value, icon: Mark, tone }: Product) => {
    const on = settings[key] && takesCards;
    const reason = isVoucherKey(key) ? state.unavailable[key] : undefined;
    const blocked = !takesCards || (!on && !settings.house_credits);
    const note = !takesCards ? needsStripe : on && reason && NOT_SELLING[reason] ? NOT_SELLING[reason] : null;
    return (
      <li key={key} className={MARK_ROW}>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
          <Mark size={22} weight={on ? "fill" : "regular"} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{line}</p>
          {note ? <p className={NOTE}>{note}</p> : null}
        </div>
        <p className={cn("font-semibold whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{value}</p>
        <Switch on={on} pending={pending || blocked} onClick={() => void flip(key, !on)} label={`${name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  const needsContract = <>Sign the House Credits Agreement first.</>;
  const needsHouseCredits = <>Turn House Credits on first.</>;
  const needsStripe = <>Connect Stripe first.</>;
  const needsCode = (
    <a className="underline" href={placeTabHref(placeId, "settings")}>
      Set a place code on Settings first: your waiters confirm cash with it.
    </a>
  );

  return (
    <>
      {testMode ? <TestBand detail="Stripe sandbox: guests pay with Stripe's test cards, no real money moves." /> : null}
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
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          <li className="flex flex-col gap-4 px-5 py-4 sm:px-6" data-place-state="stripe">
            <div className="flex items-center gap-4 text-sm">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ready ? "bg-indigo-100 text-indigo-700" : "bg-muted text-muted-foreground")}>
                <StripeLogoIcon size={22} weight={ready ? "fill" : "regular"} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">Stripe · {STAGE_LABEL[stage]}</p>
                <p className="text-muted-foreground">
                  {ready
                    ? [account.country ? COUNTRY[account.country] ?? account.country : null, testMode ? "Sandbox" : "Live"].filter(Boolean).join(" · ")
                    : `${copy.line}${testMode ? " Sandbox." : ""}`}
                </p>
              </div>
              {copy.button ? (
                <button type="button" className={cn(PILL_BUTTON_CLASS, ready && QUIET_PILL_CLASS, "shrink-0")} disabled={pending} onClick={() => void stripe()}>
                  {busy === "stripe" ? "Opening…" : copy.button}
                  {ready && busy !== "stripe" ? <ArrowSquareOutIcon size={14} weight="bold" aria-hidden /> : null}
                </button>
              ) : null}
            </div>
            {ready ? (
              <ul className="grid gap-2 sm:grid-cols-3">
                {accountChecks(account).map(({ label, done }) => (
                  <li key={label} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", done ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
                    {done ? <CheckCircleIcon size={18} weight="fill" aria-hidden /> : <ClockIcon size={18} weight="bold" aria-hidden />}
                    <span>{label}</span>
                    <span className="sr-only">{done ? ": done" : ": waiting on Stripe"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        </ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>House Credits</h2>
        <ul className="divide-border divide-y">
          <li className={MARK_ROW} data-place-state="house_credits_contract">
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
            name: "House Credits",
            line: "Guests earn and buy credit to spend here. It is your debt, always honoured.",
            icon: PiggyBankIcon,
            tone: "bg-emerald-100 text-emerald-700",
            blocked: contract.signed ? undefined : needsContract,
            note: settings.house_credits ? null : "Off: no new credit. Guests still spend what they already hold.",
          })}
        </ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Cash Payments</h2>
        <ul className="divide-border divide-y">
          {switchRow({
            key: "cash_payments",
            name: "Cash Payments",
            line: "Guests pay cash or your terminal; your waiter taps Received on visit.mesita.ai.",
            icon: MoneyIcon,
            tone: "bg-lime-100 text-lime-700",
            blocked: codeSet ? undefined : needsCode,
          })}
          {rateRow({
            key: "cash_cashback_bps",
            name: "Cash Payments Cashback-as-Credits",
            line: "Back as credit here on the bill, once your waiter taps Received. Never on the tip.",
            blocked: !settings.house_credits ? needsHouseCredits : !settings.cash_payments ? "Turn Cash Payments on first." : undefined,
          })}
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
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Mesita Payments</h2>
        <ul className="divide-border divide-y">
          {switchRow({
            key: "pay_cards",
            name: "Mesita Pay",
            line: "Guests pay the bill by card inside the app.",
            icon: DeviceMobileIcon,
            tone: "bg-sky-100 text-sky-700",
            stripe: true,
            note: settings.pay_cards
              ? fee.hold
                  ? "Off until Mesita's invoice is paid."
                  : !CARD_BILL_PAY_LIVE
                    ? ARRIVES_SOON
                    : PER_100
              : "Guests still pay from credit here.",
          })}
          {rateRow({
            key: "card_cashback_bps",
            name: "Mesita Payments Cashback-as-Credits",
            line: "Back as credit here on the card part of the bill. Never on the tip or the credit part.",
            blocked: !settings.house_credits ? needsHouseCredits : undefined,
            stripe: true,
            note: settings.card_cashback_bps !== null && !state.cashback && settings.house_credits ? "Starts once Mesita Pay takes cards." : null,
          })}
        </ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Mesita Prepayments</h2>
        <p className="text-muted-foreground px-5 pb-3 text-sm sm:px-6">
          {settings.house_credits
            ? "Guests buy credit up front with a bonus. Several vouchers add up in one wallet and pay one bill together."
            : "Turn House Credits on first: vouchers sell House Credits."}
        </p>
        <ul className="divide-border divide-y">{[...STANDARD, ...SPECIAL].map(voucherRow)}</ul>
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
