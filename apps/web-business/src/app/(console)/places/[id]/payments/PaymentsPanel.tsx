"use client";

// Payments (MESITA-3296): three cards of rows. The Stripe account first, with
// the one button its state calls for; then Payments Cashback, one switch; then
// Prepaid Vouchers, six. The owner and Mesita staff change them; the server
// refuses anyone else. No number is set here: rates, bonuses and prices are
// still open with owners.

import { useState } from "react";
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
const HEAD = "px-5 pt-4 pb-2 font-semibold sm:px-6";

const VOUCHERS: Array<{ key: PaymentKey; name: string; line: string }> = [
  { key: "voucher_200", name: "MX$200 voucher", line: "A guest pays MX$200 ahead and gets more to spend with you." },
  { key: "voucher_1000", name: "MX$1,000 voucher", line: "A guest pays MX$1,000 ahead." },
  { key: "voucher_5000", name: "MX$5,000 voucher", line: "A guest pays MX$5,000 ahead." },
  { key: "voucher_welcome", name: "Welcome voucher", line: "MX$100, once, on a guest's first visit." },
  { key: "voucher_story", name: "Story voucher", line: "MX$100 after a guest posts an Instagram story from your place." },
  { key: "voucher_vip", name: "VIP voucher", line: "MX$100, for guests Mesita marks as VIP." },
];

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

  const row = (key: PaymentKey, name: string, line: string) => (
    <li key={key} className={ROW}>
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{line}</p>
      </div>
      <Switch on={settings[key]} pending={pending} onClick={() => void flip(key, !settings[key])} label={`${name}: ${settings[key] ? "on" : "off"}`} />
    </li>
  );

  return (
    <>
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
        <ul className="divide-border divide-y">
          {row("cashback", "Payments Cashback", "Part of each card payment comes back to the guest as credit at your place.")}
        </ul>
      </Card>
      <Card className="flex flex-col p-0 sm:p-0">
        <h2 className={HEAD}>Prepaid Vouchers</h2>
        <ul className="divide-border divide-y">{VOUCHERS.map((v) => row(v.key, v.name, v.line))}</ul>
      </Card>
      {back === "return" && account.state !== "ready" && !error ? (
        <p className="text-muted-foreground text-sm">Stripe is still checking your details. This page updates when it answers.</p>
      ) : null}
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change payments.</p> : null}
    </>
  );
}
