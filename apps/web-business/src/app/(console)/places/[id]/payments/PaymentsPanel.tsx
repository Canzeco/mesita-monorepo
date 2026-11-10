"use client";

// Payments (MESITA-3296; the Place states of Main §10 since MESITA-3589).
// Configuration only (MESITA-3596, Pato: "in payments its just to configure"):
// the owner's money and its log live on Operations › Money, and there is no
// table QR (the guest shows the QR). Laid out as Pato's approved mockup
// (MESITA-3597): the test pill, an unpaid fee banner (MESITA-3461), a setup
// strip of four steps (Agreement → House Credits → Waiter code → Stripe
// Account; the first not done is outlined with its one action), three cards
// (House Credits · Cash Payments · Mesita Payments; one column on phones),
// one Stripe Account row (seven values), then Mesita Prepayments.
// Three things, never "Mesita Pay" (Pato, 2026-11-10: "Stripe Account,
// Mesita Payments, Mesita Prepayments ... Different products but with lots of
// symmetries"): Mesita Payments and Mesita Prepayments wear the same card,
// a title, one line, their switch, On/Off, what they need with a fix for each
// missing line, and their inner settings: Mesita Payments its
// Cashback-as-Credits (Off or 5%), Mesita Prepayments its voucher grid, each
// voucher its own switch, selling only while Mesita Prepayments is on. Cash
// Payments has its Cashback-as-Credits too (Off or 2%).
// The House Credits Agreement is independent of Stripe (Pato, 2026-11-09):
// signing opens a plain Agree dialog whose text is a placeholder until a
// lawyer writes it. A guest's credit is the place's debt: House Credits Off
// stops new credit, never what guests hold. The owner and Mesita staff change
// these; the server refuses anyone else and repeats each rule.

import { useState } from "react";
import { CARD_BILL_PAY_LIVE, moneyState, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CoinsIcon,
  DeviceMobileIcon,
  MoneyIcon,
  PiggyBankIcon,
  StripeLogoIcon,
  TicketIcon,
  LockSimpleIcon,
  WarningCircleIcon,
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

/** One line of a service's checklist: done, or missing with its fix. */
type Check = { label: string; done: boolean; fix?: React.ReactNode };

const NOTE = "text-muted-foreground text-xs";

/** A voucher: its bonus in its own colour (MESITA-3298) and one objective line. */
type Product = { key: PaymentKey; name: string; line: string; value: string; tone: string };

const STANDARD: Product[] = [
  { key: "voucher_200", name: "Standard voucher", line: "Guest pays $200MX, gets $220MX of credit.", value: "+10%", tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "Standard Medium voucher", line: "Guest pays $1,000MX, gets $1,200MX of credit.", value: "+20%", tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_5000", name: "Standard Large voucher", line: "Guest pays $5,000MX, gets $6,500MX of credit.", value: "+30%", tone: "bg-emerald-100 text-emerald-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome voucher", line: "Guest pays $100MX, gets $130MX of credit. Once, on the first visit.", value: "+30%", tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_story", name: "Story voucher", line: "Guest pays $100MX, gets $130MX of credit after posting an Instagram story at your place.", value: "+30%", tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP voucher", line: "Guest pays $100MX, gets $130MX of credit. VIP guests only.", value: "+30%", tone: "bg-violet-100 text-violet-700" },
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
  needs_account: "Not for sale until the Stripe Account takes cards.",
  needs_house_credits: "Not for sale until House Credits is on.",
  needs_billing: "Not for sale until Mesita's invoice is paid.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

/** Each cashback's one rate (Main §10, MESITA-3596): Off or this. The server takes nothing else. */
const CASHBACK_BPS: Record<PaymentRateKey, number> = { card_cashback_bps: 500, cash_cashback_bps: 200 };
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
      return { line: "Your own account, where Mesita Payments and Mesita Prepayments land. Not needed for House Credits or cash.", button: "Connect Stripe", open: false };
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

  const onOffPill = (on: boolean, text?: string) => (
    <span className={cn("self-start rounded-full px-2.5 py-0.5 text-xs font-semibold", on ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground")}>
      {text ?? (on ? "On" : "Off")}
    </span>
  );

  /** A fix link inside a checklist: a link to another page, or a button here. */
  const fix = (label: string, to: string | (() => void)) =>
    typeof to === "string" ? (
      <a className="ml-auto shrink-0 font-semibold underline" href={to}>
        {label}
      </a>
    ) : (
      <button type="button" className="ml-auto shrink-0 font-semibold underline disabled:opacity-60" disabled={pending} onClick={to}>
        {label}
      </button>
    );

  /** What a service needs before it works: each line done, or missing with its fix. */
  const checklist = (items: Check[]) =>
    items.length ? (
      <ul className="border-border flex flex-col gap-2 border-t pt-3 text-sm">
        {items.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.done ? (
              <CheckCircleIcon size={18} weight="fill" className="shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <WarningCircleIcon size={18} weight="fill" className="shrink-0 text-amber-600" aria-hidden />
            )}
            <span className={cn("min-w-0", !c.done && "text-muted-foreground")}>{c.label}</span>
            <span className="sr-only">{c.done ? ": done" : ": missing"}</span>
            {!c.done && c.fix ? c.fix : null}
          </li>
        ))}
      </ul>
    ) : null;

  /** One service: its mark, name, line and switch, On/Off, what it needs, and its Cashback-as-Credits. */
  const serviceCard = (args: {
    key: PaymentKey;
    name: string;
    line: string;
    icon: Icon;
    tone: string;
    /** Why it can't turn on yet; the switch stays off and disabled. */
    blocked?: React.ReactNode;
    note?: React.ReactNode;
    checks: Check[];
    /** The product's own settings inside its card: a Cashback-as-Credits, or the voucher grid. */
    inner?: React.ReactNode;
    className?: string;
  }) => {
    const on = settings[args.key];
    const blocked = !on && args.blocked;
    return (
      <Card key={args.key} className={cn("flex min-w-0 flex-col gap-4", on && "border-emerald-300", args.className)}>
        <div className="flex items-start gap-3" data-place-state={args.key}>
          {mark(args.icon, on, args.tone)}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{args.name}</h2>
            <p className="text-muted-foreground text-sm">{args.line}</p>
          </div>
          <Switch on={on} pending={pending || !!blocked} onClick={() => void flip(args.key, !on)} label={`${args.name}: ${on ? "on" : "off"}`} />
        </div>
        {onOffPill(on)}
        {blocked ? <p className={NOTE}>{args.blocked}</p> : args.note ? <p className={NOTE}>{args.note}</p> : null}
        {checklist(args.checks)}
        {args.inner}
      </Card>
    );
  };

  /** One Cashback-as-Credits: a switch between Off and its one rate, inside its payment card. */
  const cashbackBox = (args: { key: PaymentRateKey; name: string; line: string; blocked?: React.ReactNode; note?: React.ReactNode }) => {
    const value = settings[args.key];
    const on = value !== null;
    const blocked = args.blocked;
    const fixed = pct(CASHBACK_BPS[args.key]);
    const lit = on && !blocked;
    return (
      <div
        key={args.key}
        className={cn("mt-auto flex flex-col gap-1 rounded-xl p-3 text-sm", lit ? "bg-emerald-50 text-emerald-900" : "bg-muted text-muted-foreground")}
        data-place-state={args.key}
      >
        <div className="flex items-center gap-3">
          <CoinsIcon size={20} weight={lit ? "fill" : "regular"} className="shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">Cashback-as-Credits</p>
          <p className="font-semibold whitespace-nowrap tabular-nums">{on ? pct(value) : `Off · ${fixed}`}</p>
          <Switch
            on={on}
            pending={pending || (!on && !!blocked)}
            onClick={() => void rate(args.key, on ? null : CASHBACK_BPS[args.key])}
            label={`${args.name}: ${on ? fixed : "off"}`}
          />
        </div>
        <p className="text-xs">{args.line}</p>
        {blocked ? <p className="text-xs">{blocked}</p> : args.note ? <p className="text-xs">{args.note}</p> : null}
      </div>
    );
  };

  const voucherCard = ({ key, name, line, value, tone }: Product) => {
    const on = settings[key];
    const reason = isVoucherKey(key) ? state.unavailable[key] : undefined;
    const blocked = !on && !settings.house_credits;
    const note = on && settings.prepayments && reason && NOT_SELLING[reason] ? NOT_SELLING[reason] : null;
    return (
      <li key={key} className="border-border flex min-w-0 flex-col gap-2 rounded-xl border p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", on ? tone : "bg-muted text-muted-foreground")}>{value}</span>
          <span className="ml-auto">
            <Switch on={on} pending={pending || blocked} onClick={() => void flip(key, !on)} label={`${name}: ${on ? "on" : "off"}`} />
          </span>
        </div>
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{line}</p>
        {note ? <p className={NOTE}>{note}</p> : null}
      </li>
    );
  };

  const needsContract = <>Sign the House Credits Agreement first.</>;
  const needsHouseCredits = <>Turn House Credits on first.</>;
  const needsCode = (
    <a className="underline" href={placeTabHref(placeId, "settings")}>
      Set a place code on Settings first: your waiters confirm cash with it.
    </a>
  );
  const settingsHref = placeTabHref(placeId, "settings");

  // The setup strip: four steps in order; the first not done is the next one, with its one action.
  const steps: { key: string; name: string; line: string; done: boolean; action: React.ReactNode }[] = [
    {
      key: "step_agreement",
      name: "Agreement",
      line: contract.signed ? signedOn(contract) : "House Credits terms",
      done: contract.signed,
      action: fix("Sign", () => setAgreeing(true)),
    },
    {
      key: "step_house_credits",
      name: "House Credits",
      line: settings.house_credits ? "On" : "Credit to spend here",
      done: settings.house_credits,
      action: contract.signed ? fix("Turn on", () => void flip("house_credits", true)) : null,
    },
    {
      key: "step_waiter_code",
      name: "Waiter code",
      line: codeSet ? "Set" : "For cash bills",
      done: codeSet,
      action: fix("Set", settingsHref),
    },
    {
      key: "step_stripe",
      name: "Stripe Account",
      line: ready ? STAGE_LABEL[stage] : "For Payments + Prepayments",
      done: ready,
      action: copy.button && !copy.open ? fix(copy.button, () => void stripe()) : null,
    },
  ];
  const next = steps.find((s) => !s.done)?.key;
  const stripeFix = copy.button && !copy.open ? fix(copy.button.replace(" Stripe", ""), () => void stripe()) : undefined;
  const needsStripe = <>Connect the Stripe Account first: it has to take cards.</>;
  const feeCheck: Check[] = fee.hold ? [{ label: "Mesita's invoice unpaid", done: false, fix: fee.invoice?.url ? fix("Pay", fee.invoice.url) : undefined }] : [];

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
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Setup" data-setup-steps>
        {steps.map((s, n) => (
          <li
            key={s.key}
            className={cn(
              "border-border bg-card flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-sm",
              s.key === next && "border-foreground ring-foreground ring-1",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                s.done ? "bg-emerald-500 text-white" : "border-border text-muted-foreground border",
              )}
            >
              {s.done ? <CheckIcon size={14} weight="bold" aria-hidden /> : n + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="text-muted-foreground truncate text-xs">{s.line}</p>
            </div>
            <span className="sr-only">{s.done ? ": done" : s.key === next ? ": next" : ": to do"}</span>
            {s.key === next && canEdit ? s.action : null}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {serviceCard({
          key: "house_credits",
          name: "House Credits",
          line: "Guests earn and buy credit to spend here. It is your debt, always honoured.",
          icon: PiggyBankIcon,
          tone: "bg-emerald-100 text-emerald-700",
          blocked: contract.signed ? undefined : needsContract,
          note: settings.house_credits ? null : "Off: no new credit. Guests still spend what they already hold.",
          checks: [
            {
              label: contract.signed ? `House Credits Agreement: ${signedOn(contract).toLowerCase()}` : "House Credits Agreement not signed",
              done: contract.signed,
              fix: fix("Sign", () => setAgreeing(true)),
            },
          ],
        })}
        {serviceCard({
          key: "cash_payments",
          name: "Cash Payments",
          line: "Guests pay cash or your terminal; your waiter taps Received on visit.mesita.ai.",
          icon: MoneyIcon,
          tone: "bg-lime-100 text-lime-700",
          blocked: codeSet ? undefined : needsCode,
          checks: [
            { label: codeSet ? "Waiter code set" : "Waiter code not set", done: codeSet, fix: fix("Set it", settingsHref) },
            { label: settings.house_credits ? "House Credits on, for its Cashback-as-Credits" : "House Credits off, so no Cashback-as-Credits", done: settings.house_credits },
          ],
          inner: (
            <>
              {codeSet ? (
                <p className={NOTE} data-waiter-charge>
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
              {cashbackBox({
                key: "cash_cashback_bps",
                name: "Cash Payments Cashback-as-Credits",
                line: "Back as credit here on the bill, once your waiter taps Received. Never on the tip.",
                blocked: !settings.house_credits ? needsHouseCredits : !settings.cash_payments ? "Turn Cash Payments on first." : undefined,
              })}
            </>
          ),
        })}
        {serviceCard({
          key: "pay_cards",
          name: "Mesita Payments",
          line: "Guests pay the bill by card inside the app.",
          icon: DeviceMobileIcon,
          tone: "bg-sky-100 text-sky-700",
          blocked: account.charges_enabled ? undefined : needsStripe,
          note: settings.pay_cards
            ? !account.charges_enabled
              ? "On once the Stripe Account takes cards."
              : fee.hold
                ? "Off until Mesita's invoice is paid."
                : !CARD_BILL_PAY_LIVE
                  ? ARRIVES_SOON
                  : PER_100
            : "Guests still pay from credit here.",
          checks: [
            { label: account.charges_enabled ? "Stripe Account takes cards" : "Stripe Account not connected", done: account.charges_enabled, fix: stripeFix },
            { label: settings.house_credits ? "House Credits on, for its Cashback-as-Credits" : "House Credits off, so no Cashback-as-Credits", done: settings.house_credits },
            ...feeCheck,
          ],
          inner: cashbackBox({
            key: "card_cashback_bps",
            name: "Mesita Payments Cashback-as-Credits",
            line: "Back as credit here on the card part of the bill. Never on the tip or the credit part.",
            blocked: !settings.house_credits ? needsHouseCredits : undefined,
            note: settings.card_cashback_bps !== null && !state.cashback && settings.house_credits ? "Starts once Mesita Payments takes cards." : null,
          }),
        })}
      </div>
      <Card className="flex flex-col gap-4" >
        <div className="flex flex-wrap items-center gap-4 text-sm" data-place-state="stripe">
          {mark(StripeLogoIcon, ready, "bg-indigo-100 text-indigo-700")}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              Stripe Account {onOffPill(ready, STAGE_LABEL[stage])}
            </p>
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
      </Card>
      {serviceCard({
        key: "prepayments",
        name: "Mesita Prepayments",
        line: "Guests pay ahead by card and get extra credit. Several vouchers add up in one wallet and pay one bill together.",
        icon: TicketIcon,
        tone: "bg-emerald-100 text-emerald-700",
        blocked: !settings.house_credits ? needsHouseCredits : !account.charges_enabled ? needsStripe : undefined,
        note: settings.prepayments
          ? !account.charges_enabled
            ? "On once the Stripe Account takes cards."
            : fee.hold
              ? "Off until Mesita's invoice is paid."
              : state.sell.length === 0
                ? "Switch on at least one voucher to sell."
                : null
          : null,
        checks: [
          {
            label: settings.house_credits ? "House Credits on" : "House Credits off",
            done: settings.house_credits,
            fix: contract.signed ? fix("Turn on", () => void flip("house_credits", true)) : fix("Sign", () => setAgreeing(true)),
          },
          { label: account.charges_enabled ? "Stripe Account takes cards" : "Stripe Account not connected", done: account.charges_enabled, fix: stripeFix },
          ...feeCheck,
        ],
        inner: (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-place-state="vouchers">
              {[...STANDARD, ...SPECIAL].map(voucherCard)}
            </ul>
            {!settings.prepayments ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm" data-vouchers-locked>
                <LockSimpleIcon size={16} weight="bold" aria-hidden /> Which vouchers you sell, once Mesita Prepayments is on.
              </p>
            ) : null}
          </>
        ),
      })}
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
