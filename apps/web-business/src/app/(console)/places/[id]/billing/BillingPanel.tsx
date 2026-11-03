"use client";

// Billing, as the place sees it (MESITA-3128; its own page under Manage since
// MESITA-3160, Pato: "in manage do add the billing section"; under Premier in
// MESITA-3154, in Settings from MESITA-3136). The plan and the charges are
// the team's; the card is the payer's own, so only the payer sees it and can
// replace it (Stripe Checkout in setup mode, back to this page). Every amount
// and date is the server's.

import Link from "next/link";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { startPremier, type PlaceBilling } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { placeTabHref, returnUrl } from "@/lib/routes";

const PLAN_LABEL: Record<string, string> = { boost_2x: "Premier 2X", boost_5x: "Premier 5X" };
const LABEL_BY_RANK: Record<number, string> = { 1: "Premier 2X", 2: "Premier 5X" };
const STATUS: Record<PlaceBilling["charges"][number]["status"], string> = {
  paid: "Paid",
  declined: "Declined",
  charging: "Charging",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function brand(b: string): string {
  return b === "amex" ? "American Express" : b.charAt(0).toUpperCase() + b.slice(1);
}

export function BillingPanel({
  placeId,
  billing,
  error: loadError,
  saved,
}: {
  placeId: string;
  billing: PlaceBilling | null;
  error: string | null;
  saved: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const premierHref = placeTabHref(placeId, "premier");

  if (!billing) {
    return (
      <Card>
        <p className="font-semibold">Billing didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
      </Card>
    );
  }

  async function updateCard() {
    setBusy(true);
    setError(null);
    const r = await startPremier({ placeId, updateCard: true, returnUrl: returnUrl(placeTabHref(placeId, "billing")) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.data.url) window.location.assign(r.data.url);
  }

  const { plan, card, payer, charges } = billing;

  return (
    <section id="billing" className="flex scroll-mt-6 flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Billing</h2>
      {saved ? <Card className="text-sm">Your card is saved.</Card> : null}

      <Card className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Plan</p>
        {plan ? (
          <>
            <p className="font-semibold">
              {PLAN_LABEL[plan.tier] ?? "Premier"} · {usd(plan.amount_cents)} a {plan.interval}
            </p>
            <p className="text-muted-foreground text-sm">
              {plan.next_charge_at ? `Next charge ${day(plan.next_charge_at)}.` : "No charge scheduled."}{" "}
              <Link href={premierHref} className="text-foreground font-semibold underline underline-offset-4">Change or stop in Premier</Link>
            </p>
          </>
        ) : (
          <p className="text-sm">
            No paid plan.{" "}
            <Link href={premierHref} className="font-semibold underline underline-offset-4">See Premier</Link>
          </p>
        )}
      </Card>

      <Card className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-sm">Card</p>
        {payer === "you" ? (
          <>
            <div className="flex items-center gap-3">
              <CreditCard className="text-muted-foreground size-5" aria-hidden />
              {card ? (
                <span className="font-semibold">
                  {brand(card.brand)} •••• {card.last4}
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    expires {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
                  </span>
                </span>
              ) : (
                <span className="text-sm">Your card on file</span>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void updateCard()}
              className="border-border hover:bg-muted h-9 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? "Opening…" : "Update card"}
            </button>
          </>
        ) : payer === "team" ? (
          <p className="text-sm">Paid by another member of your team. Only they see and change the card.</p>
        ) : (
          <p className="text-sm">
            No card saved. Your card is saved when you start Premier.{" "}
            <Link href={premierHref} className="font-semibold underline underline-offset-4">Start Premier</Link>
          </p>
        )}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </Card>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Charges</h3>
        {charges.length === 0 ? (
          <Card className="text-muted-foreground text-sm">Nothing charged yet.</Card>
        ) : (
          <Card className="divide-border divide-y p-0 sm:p-0">
            {charges.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {LABEL_BY_RANK[c.tier] ?? "Premier"} · {c.interval === "year" ? "a year" : "a month"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {day(c.at)} · covers {day(c.starts_at)} to {day(c.ends_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{usd(c.amount_cents)}</p>
                  <p className={c.status === "declined" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{STATUS[c.status]}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </section>
  );
}
