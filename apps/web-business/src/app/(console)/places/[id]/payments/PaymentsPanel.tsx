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
  ChampagneIcon,
  CoffeeIcon,
  CoinsIcon,
  CrownIcon,
  ForkKnifeIcon,
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

const ROW = "flex min-h-14 items-center justify-between gap-4 px-5 py-3 text-sm sm:px-6";
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
  line: "Guest pays by card, gets 5% of it back as credit at your place.",
  value: "5%",
  icon: CoinsIcon,
  tone: "bg-amber-100 text-amber-700",
};

// Standard: any guest, any time. Special: one condition each (MESITA-3298).
const STANDARD: Product[] = [
  { key: "voucher_200", name: "MX$200 voucher", line: "Guest pays MX$200, gets MX$220 of credit.", value: "+10%", icon: CoffeeIcon, tone: "bg-emerald-100 text-emerald-700" },
  { key: "voucher_1000", name: "MX$1,000 voucher", line: "Guest pays MX$1,000, gets MX$1,200 of credit.", value: "+20%", icon: ForkKnifeIcon, tone: "bg-sky-100 text-sky-700" },
  { key: "voucher_5000", name: "MX$5,000 voucher", line: "Guest pays MX$5,000, gets MX$6,500 of credit.", value: "+30%", icon: ChampagneIcon, tone: "bg-violet-100 text-violet-700" },
];

const SPECIAL: Product[] = [
  { key: "voucher_welcome", name: "Welcome voucher", line: "Guest pays MX$100, gets MX$130 of credit. Once, on the first visit.", value: "+30%", icon: HandWavingIcon, tone: "bg-orange-100 text-orange-700" },
  { key: "voucher_story", name: "Story voucher", line: "Guest pays MX$100, gets MX$130 of credit after posting an Instagram story at your place.", value: "+30%", icon: InstagramLogoIcon, tone: "bg-pink-100 text-pink-700" },
  { key: "voucher_vip", name: "VIP voucher", line: "Guest pays MX$100, gets MX$130 of credit. VIP guests only.", value: "+30%", icon: CrownIcon, tone: "bg-yellow-100 text-yellow-700" },
];

/** Why a switched-on voucher is not for sale yet, beside its switch
 *  (MESITA-3303). The guest sees the same reason on the Vouchers tab. */
const NOT_SELLING: Partial<Record<VoucherReason, string>> = {
  needs_account: "Not for sale until Stripe setup is complete.",
  not_yet: "Not on sale yet.",
  needs_card_payments: "On sale once card payments are on.",
  needs_instagram: "On sale once the Instagram connection is on.",
};

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
          <li className={ROW}>
            <div className="min-w-0">
              <p className="font-medium">
                Stripe account
                {testMode ? <span className="text-muted-foreground font-normal"> · Test mode</span> : null}
              </p>
              <p className="text-muted-foreground">{copy.line}</p>
            </div>
            {copy.button ? (
              <button type="button" className={cn(PILL_BUTTON_CLASS, "shrink-0")} disabled={pending} onClick={() => void stripe()}>
                {busy === "stripe" ? "Opening…" : copy.button}
              </button>
            ) : null}
          </li>
          <li className={ROW}>
            <div className="min-w-0">
              <p className="font-medium">Digital Payments</p>
              <p className="text-muted-foreground">Guests pay the bill from their phone by card, Apple Pay or Google Pay.</p>
            </div>
            <span className={cn("shrink-0 font-medium", account.state !== "ready" && "text-muted-foreground")}>
              {account.state === "ready" ? "On" : "Needs Stripe"}
            </span>
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
