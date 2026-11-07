"use client";

// Payments (MESITA-3296): three cards of rows. The Stripe account first, with
// the one button its state calls for; then Payments Cashback, one switch; then
// Prepaid Vouchers, six. The owner and Mesita staff change them; the server
// refuses anyone else. No number is set here: rates, bonuses and prices are
// still open with owners.

import { useState } from "react";
import { moneyState, TestBand, type VoucherReason } from "@mesita/place-profile";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  ClockIcon,
  CoinsIcon,
  DeviceMobileIcon,
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
import {
  openPaymentDashboard,
  type PaymentAccount,
  type PaymentKey,
  type PlacePayments,
  setPlacePayment,
  startPaymentOnboarding,
} from "@/lib/business-api";

// A switch row with a mark: tile, name and line, the value, the switch. The
// last column is the Switch's own width, as on Discounts.
const MARK_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-4 px-5 py-3 text-sm sm:px-6";
// Digital Payments: the same row with a status word where the switch goes.
const STATUS_ROW = "grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-sm sm:px-6";
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
  line: "Guest pays by card, gets 5% of it back as credit at your place.",
  value: "5%",
  icon: CoinsIcon,
  tone: "bg-amber-100 text-amber-700",
};

// Standard: any guest, any time. Special: one condition each (MESITA-3298).
const STANDARD: Product[] = [
  // One mark and one colour for the standard three (MESITA-3326, Pato: "the
  // standard deals/promos must have the same icon and the same color"): the
  // wallet on emerald, as the guest's Promos catalog draws them.
  { key: "voucher_200", name: "Standard voucher", line: "Guest pays MX$200, gets MX$220 of credit.", value: "+10%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "Standard Medium voucher", line: "Guest pays MX$1,000, gets MX$1,200 of credit.", value: "+20%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_5000", name: "Standard Large voucher", line: "Guest pays MX$5,000, gets MX$6,500 of credit.", value: "+30%", icon: WalletIcon, tone: "bg-emerald-100 text-emerald-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome voucher", line: "Guest pays MX$100, gets MX$130 of credit. Once, on the first visit.", value: "+30%", icon: HandWavingIcon, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_story", name: "Story voucher", line: "Guest pays MX$100, gets MX$130 of credit after posting an Instagram story at your place.", value: "+30%", icon: InstagramLogoIcon, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP voucher", line: "Guest pays MX$100, gets MX$130 of credit. VIP guests only.", value: "+30%", icon: CrownIcon, tone: "bg-violet-100 text-violet-700" },
];

/** Why a switched-on voucher is not for sale yet, beside its switch
 *  (MESITA-3303). The guest sees the same reason on the Vouchers tab. */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until Stripe setup is complete.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

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

export function PaymentsPanel({ placeId, initial, back }: { placeId: string; initial: PlacePayments; back: "return" | "refresh" | null }) {
  const [settings, setSettings] = useState(initial.settings);
  const [busy, setBusy] = useState<PaymentKey | "stripe" | null>(null);
  const [error, setError] = useState<string | null>(back === "refresh" ? "The Stripe setup link expired. Open it again." : null);
  const { account, can_edit: canEdit, test_mode: testMode } = initial;
  const copy = accountCopy(account);
  const ready = account.state === "ready";
  const pending = !canEdit || busy !== null;
  // Which switched-on vouchers a guest can buy right now, and why the others
  // cannot: the same rule the server sells by (money-state, one source).
  const selling = moneyState(settings, { charges_enabled: account.charges_enabled }, null);

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
    return (
      <li key={key} className={MARK_ROW}>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
          <Mark size={22} weight={on ? "fill" : "regular"} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{line}</p>
          {on && key !== "cashback" && selling.unavailable[key] && NOT_SELLING[selling.unavailable[key]] ? (
            <p className="text-muted-foreground text-xs">{NOT_SELLING[selling.unavailable[key]]}</p>
          ) : null}
        </div>
        <p className={cn("font-semibold whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{value}</p>
        <Switch on={on} pending={pending} onClick={() => void flip(key, !on)} label={`${name}: ${on ? "on" : "off"}`} />
      </li>
    );
  };

  return (
    <>
      {testMode ? <TestBand detail="Mesita's fee: 5% on vouchers, 5% on card payments. Guests pay with Stripe's test card." /> : null}
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
          </li>
          <li className={STATUS_ROW}>
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ready ? "bg-sky-100 text-sky-700" : "bg-muted text-muted-foreground")}>
              <DeviceMobileIcon size={22} weight={ready ? "fill" : "regular"} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Digital Payments</p>
              <p className="text-muted-foreground">Guests pay the bill from their phone by card, Apple Pay or Google Pay.</p>
            </div>
            <span className={cn("shrink-0 font-medium", !ready && "text-muted-foreground")}>{ready ? "On" : "Needs Stripe"}</span>
          </li>
        </ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">{row(CASHBACK)}</ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Standard vouchers</h2>
        <ul className="divide-border divide-y">{STANDARD.map(row)}</ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Special vouchers</h2>
        <ul className="divide-border divide-y">{SPECIAL.map(row)}</ul>
      </Card>
      {back === "return" && account.state !== "ready" && !error ? (
        <p className="text-muted-foreground text-sm">Stripe is still checking your details. This page updates when it answers.</p>
      ) : null}
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change payments.</p> : null}
    </>
  );
}
