"use client";

// Payments (MESITA-3296, four sections since MESITA-3408): while the account
// cannot charge, a Connect card leads (MESITA-3384). Then the place's own
// Stripe account, with the one button its state calls for; the owner's money
// (MESITA-3307: totals, the fee note, the rows; owners only); Visit
// Checkout, the bill in its order (House Credits, Mesita Pay, Outside
// Mesita), one switch, and the table QR to print (MESITA-3382); Payments Cashback, one switch; Prepaid Vouchers, six.
// An unpaid fee invoice (MESITA-3461) shows a banner on top: cards are off
// until it is paid, then on again by themselves (the owner's switch is never
// touched). A guest's credit is the place's debt, so no switch refuses it. The owner and
// Mesita staff change them; the server refuses anyone else. No number is set
// here: rates, bonuses and prices are Mesita's.

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
import { MoneySection } from "./MoneySection";
import { TableQr } from "./TableQr";
import {
  openPaymentDashboard,
  type PaymentAccount,
  type PaymentKey,
  type PlaceMoney,
  type PlacePayments,
  setPlacePayment,
  startPaymentOnboarding,
} from "@/lib/business-api";

// A switch row with a mark: tile, name and line, the value, the switch. The
// last column is the Switch's own width, as on Discounts.
const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-4 px-5 py-3 text-sm sm:px-6";
const HEAD = "px-5 pt-4 pb-2 font-semibold sm:px-6";

/** A money product: its mark in its own colour, always shown (Pato,
 *  MESITA-3298: "use different colors for each type"), and one objective
 *  line: what the guest pays and what they get, nothing else (Pato: "be super
 *  objective"). The bonuses are the plan's (MESITA-3272); nothing here sells
 *  one. */
type Product = { key: PaymentKey; name: string; line: string; value: string; icon: Icon; tone: string };

const CASHBACK: Product = {
  key: "cashback",
  name: "Payments Cashback",
  // Two rates (MESITA-3545, Payments Flow v2): 5% on Mesita Pay, 2% on a bill
  // paid outside through the waiter's code and confirmed with Received. The
  // cash half needs no Stripe, only a place code.
  line: "Guest pays with Mesita Pay, gets 5% back as credit at your place. Pays cash or your terminal through your waiter's code, gets 2% once your waiter taps Received. Works without Stripe for cash.",
  value: "5% · 2%",
  icon: CoinsIcon,
  tone: "bg-amber-100 text-amber-700",
};

// Standard: any guest, any time. Special: one condition each (MESITA-3298).
const STANDARD: Product[] = [
  // One mark and one colour for the standard three (MESITA-3326, Pato: "the
  // standard deals/promos must have the same icon and the same color"): the
  // wallet on emerald, as the guest's Promos catalog draws them.
  { key: "voucher_200", name: "Standard voucher", line: "Guest pays $200,MX gets $220MX of credit.", value: "+10%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "Standard Medium voucher", line: "Guest pays $1,000,MX gets $1,200MX of credit.", value: "+20%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_5000", name: "Standard Large voucher", line: "Guest pays $5,000,MX gets $6,500MX of credit.", value: "+30%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome voucher", line: "Guest pays $100,MX gets $130MX of credit. Once, on the first visit.", value: "+30%", icon: HandWavingIcon, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_story", name: "Story voucher", line: "Guest pays $100,MX gets $130MX of credit after posting an Instagram story at your place.", value: "+30%", icon: InstagramLogoIcon, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP voucher", line: "Guest pays $100,MX gets $130MX of credit. VIP guests only.", value: "+30%", icon: CrownIcon, tone: "bg-violet-100 text-violet-700" },
];

/** Mesita Pay (MESITA-3396's Cards; named by MESITA-3410, Pato: "Mesita Pay,
 *  that's the whole concept"): guests pay the bill on Mesita. Cashback is a
 *  separate, optional switch (MESITA-3411). The key stays `pay_cards`. */
const MESITA_PAY: Product = {
  key: "pay_cards",
  name: "Mesita Pay",
  line: "Guests pay the bill from their phone by card, Apple Pay or Google Pay.",
  value: "",
  icon: DeviceMobileIcon,
  tone: "bg-sky-100 text-sky-700",
};

/** A row with no switch: what holds, stated. Muted, so only switches read as
 *  controls (MESITA-3408). */
type InfoRow = { name: string; line: string; icon: Icon };

const HOUSE_CREDITS: InfoRow = {
  name: "House Credits",
  line: "Spent on the bill whenever a guest holds credit here. It is your debt, always honoured.",
  icon: PiggyBankIcon,
};
const OUTSIDE: InfoRow = {
  name: "Outside Mesita",
  line: "Cash or your own terminal. When the waiter taps Received, the guest gets 2% back as credit here, which you owe.",
  icon: MoneyIcon,
};

/** Card payment of the bill is W2b. Live since MESITA-3305 (the flag is
 *  true), so the note shows only if the flag is ever turned back off. */
const ARRIVES_SOON = "Card payment of the bill arrives soon.";
const NOTE = "text-muted-foreground text-xs";

/** What a card payment costs the place, under the Mesita Pay switch
 *  (MESITA-3461; the 5% fee is billed apart, cashback is the guest's credit). */
const PER_100 = "Per MX$100 by card: Stripe's card fee + MX$5 to Mesita + MX$5 the guest can spend here later.";

/** The waiter's charge (MESITA-3306) and the staff list of payments
 *  (MESITA-3462): staff open both on visit.mesita.ai with the place code, so
 *  the page names the links once the code is set and sends the owner to
 *  Settings while it is not. */
const VISIT_ORIGIN = "https://visit.mesita.ai";
const WAITER_CHARGE_NEEDS_CODE = "Set a place code on Settings to take the waiter's charge";

/** The six voucher switches, the keys moneyState reports a reason for. */
type VoucherKey = Extract<PaymentKey, `voucher_${string}`>;
const isVoucherKey = (k: PaymentKey): k is VoucherKey => k.startsWith("voucher_");

/** Why a switched-on voucher is not for sale yet, beside its switch
 *  (MESITA-3303). The guest sees the same reason on the Vouchers tab. */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until Stripe setup is complete.",
  needs_house_credits: "Not for sale until House Credits is on.",
  needs_billing: "Not for sale until Mesita's invoice is paid.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

/** Why a switched-on voucher cannot sell while the account cannot charge
 *  (MESITA-3307): one grey line by the account's state, with the Stripe
 *  button beside it. */
function accountReason(a: PaymentAccount): string {
  if (a.state === "restricted") return a.requirements_due > 0 ? "Stripe needs more information" : "Stripe paused this account";
  return "Finish Stripe onboarding";
}

/** The Connect nudge (MESITA-3384): while the account cannot charge, the page
 *  leads with what connecting opens, in the catalog's numbers (the voucher
 *  bonuses above, the 5% fee of PER_100). Objective: what the guest pays and
 *  gets, what Mesita takes; nothing sold. */
const CONNECT_TITLE = "Connect Stripe to sell vouchers and take payments";
const CONNECT_LINE =
  "Guests pay the bill from their phone with Mesita Pay and buy prepaid vouchers: you get the money up front, they get 10% to 30% more credit to spend here. Mesita's fee is 5% of what guests pay by card.";

/** Where the account was opened. Permanent on the account (Stripe). */
const COUNTRY: Record<string, string> = { MX: "Mexico", US: "United States" };

/** A connected account's three checks (MESITA-3390, Pato: "when Stripe is
 *  connected, use a better UI"): each green when Stripe says so, otherwise
 *  waiting. The words are the owner's, never Stripe's field names. */
function accountChecks(a: PaymentAccount): { label: string; done: boolean }[] {
  return [
    { label: "Card payments", done: a.charges_enabled },
    { label: "Payouts to your bank", done: a.payouts_enabled },
    { label: "Details verified", done: a.details_submitted && a.requirements_due === 0 },
  ];
}

/** Open Stripe leaves the app, so it is the quiet grey button (outbound links
 *  stay quiet); Connect and Continue stay the black one. */
const QUIET_PILL_CLASS = "bg-muted text-foreground hover:bg-muted/70 hover:opacity-100";

/** The account row: one line and one button per state. */
function accountCopy(a: PaymentAccount): { line: string; button: string | null; open: boolean } {
  switch (a.state) {
    case "none":
      return { line: "Where guests' payments land. Yours, set up with Stripe.", button: "Connect Stripe", open: false };
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

export function PaymentsPanel({
  placeId,
  placeName,
  initial,
  money,
  back,
}: {
  placeId: string;
  /** Printed under the table QR (MESITA-3382). */
  placeName: string | null;
  initial: PlacePayments;
  /** The owner's money (MESITA-3307); null for an editor or when it failed. */
  money: PlaceMoney | null;
  back: "return" | "refresh" | null;
}) {
  const [settings, setSettings] = useState(initial.settings);
  const [busy, setBusy] = useState<PaymentKey | "stripe" | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode, code_set: codeSet, fee } = initial;
  const chargeUrl = `${VISIT_ORIGIN}/charge/${encodeURIComponent(placeId)}`;
  const staffListUrl = `${VISIT_ORIGIN}/payments/${encodeURIComponent(placeId)}`;
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const pending = !canEdit || busy !== null;
  // Which switched-on vouchers a guest can buy right now, and why the others
  // cannot: the same rule the server sells by (money-state, one source).
  const selling = moneyState(settings, { charges_enabled: account.charges_enabled, fee_hold: fee.hold }, null);

  async function flip(key: PaymentKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    const r = await setPlacePayment(placeId, key, enabled);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setSettings(r.data);
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

  const row = ({ key, name, line, value, icon: Mark, tone }: Product) => {
    const on = settings[key];
    const reason = isVoucherKey(key) ? selling.unavailable[key] : undefined;
    // One state note at most, then the W2b note last.
    let note: string | null = null;
    let needsStripe = false;
    if (on && reason === "needs_account") {
      note = accountReason(account);
      needsStripe = true;
    } else if (on && reason && NOT_SELLING[reason]) note = NOT_SELLING[reason];
    if (key === "pay_cards") {
      note = on
        ? !account.charges_enabled
          ? "Needs Stripe: on once the account can charge."
          : fee.hold
            ? "Off until Mesita's invoice is paid."
            : null
        : "Guests still pay from credit here.";
    }
    // The place-code line lives once, under Visit Checkout (no switch is gated on it).
    if (key === "cashback" && on && !selling.cashback) note = "2% back on bills paid to the waiter works now. 5% on Mesita Pay starts when Stripe is ready.";
    const soon = !CARD_BILL_PAY_LIVE && (key === "pay_cards" || key === "cashback");
    return (
      <li key={key} className={MARK_ROW}>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
          <Mark size={22} weight={on ? "fill" : "regular"} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{line}</p>
          {note ? (
            <p className={NOTE}>
              {note}
              {needsStripe && canEdit ? (
                <>
                  {" · "}
                  <button type="button" className="underline" disabled={pending} onClick={() => void stripe()}>
                    {copy.button ?? "Open Stripe"}
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
          {soon ? <p className={NOTE}>{ARRIVES_SOON}</p> : null}
          {key === "pay_cards" ? <p className={NOTE}>{PER_100}</p> : null}
        </div>
        {value ? <p className={cn("font-semibold whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{value}</p> : <span />}
        <Switch on={on} pending={pending} onClick={() => void flip(key, !on)} label={`${name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  // The same four cells as a switch row, so the text lines up; nothing to flip.
  const infoRow = ({ name, line, icon: Mark }: InfoRow) => (
    <li key={name} className={MARK_ROW}>
      <span className="bg-muted text-muted-foreground grid size-10 shrink-0 place-items-center rounded-xl">
        <Mark size={22} weight="regular" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{line}</p>
      </div>
      <span />
      <span />
    </li>
  );

  return (
    <>
      {testMode ? <TestBand detail="Guests pay with Stripe's test card." /> : null}
      {!account.charges_enabled ? (
        <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
            <StripeLogoIcon size={22} weight="fill" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <h2 className="font-semibold">{CONNECT_TITLE}</h2>
            <p className="text-muted-foreground">{CONNECT_LINE}</p>
          </div>
          {canEdit && copy.button && !copy.open ? (
            <button type="button" className={cn(PILL_BUTTON_CLASS, "shrink-0 self-start sm:self-center")} disabled={pending} onClick={() => void stripe()}>
              {busy === "stripe" ? "Opening…" : copy.button}
            </button>
          ) : null}
        </Card>
      ) : null}
      {fee.hold ? (
        <p className={cn(ERROR_BOX_CLASS, "flex flex-wrap items-center justify-between gap-3")} data-fee-hold>
          <span>
            Mesita&apos;s invoice
            {fee.invoice ? ` of ${moneyLabel(fee.invoice.amount_cents, fee.invoice.currency)}` : ""} is unpaid, so card payments are off. They
            come back on by themselves once it is paid.
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
          <li className="flex flex-col gap-4 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-4 text-sm">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ready ? "bg-indigo-100 text-indigo-700" : "bg-muted text-muted-foreground")}>
                <StripeLogoIcon size={22} weight={ready ? "fill" : "regular"} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ready ? "Stripe connected" : "Stripe account"}</p>
                <p className="text-muted-foreground">
                  {ready
                    ? [account.country ? COUNTRY[account.country] ?? account.country : null, testMode ? "Test mode" : "Live"].filter(Boolean).join(" · ")
                    : `${copy.line}${testMode ? " Test mode." : ""}`}
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
            {!ready && money && money.available_cents + money.pending_cents > 0 ? (
              <p className={NOTE}>Guests can still spend credit here.</p>
            ) : null}
            {ready && !CARD_BILL_PAY_LIVE && !selling.mesita_pay ? (
              <p className={NOTE}>The green Mesita Pay mark shows on your place once a voucher is on sale.</p>
            ) : null}
          </li>
        </ul>
      </Card>
      {money ? <MoneySection placeId={placeId} initial={money} /> : null}
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Visit Checkout</h2>
        <ul className="divide-border divide-y">
          {infoRow(HOUSE_CREDITS)}
          {row(MESITA_PAY)}
          {infoRow(OUTSIDE)}
          <TableQr placeId={placeId} placeName={placeName} live={settings.pay_cards} />
        </ul>
        <p className={cn(NOTE, "px-5 pb-4 sm:px-6")} data-waiter-charge>
          {codeSet ? (
            <>
              Waiter&apos;s charge:{" "}
              <a className="underline" href={chargeUrl} target="_blank" rel="noreferrer">
                {chargeUrl.replace("https://", "")}
              </a>
              <br />
              Staff list of payments:{" "}
              <a className="underline" href={staffListUrl} target="_blank" rel="noreferrer">
                {staffListUrl.replace("https://", "")}
              </a>
            </>
          ) : (
            <a className="underline" href={placeTabHref(placeId, "settings")}>
              {WAITER_CHARGE_NEEDS_CODE}
            </a>
          )}
        </p>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">{row(CASHBACK)}</ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Prepaid Vouchers</h2>
        {/* MESITA-3505: several vouchers fund one wallet and pay one bill. */}
        <p className="text-muted-foreground px-5 pb-3 text-sm sm:px-6">
          A guest can buy several vouchers: the credits add up in one wallet and pay one bill together.
        </p>
        <ul className="divide-border divide-y">{[...STANDARD, ...SPECIAL].map(row)}</ul>
      </Card>
      {back === "return" && account.state !== "ready" && !error ? (
        <p className="text-muted-foreground text-sm">Stripe is still checking your details. This page updates when it answers.</p>
      ) : null}
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change payments.</p> : null}
    </>
  );
}
