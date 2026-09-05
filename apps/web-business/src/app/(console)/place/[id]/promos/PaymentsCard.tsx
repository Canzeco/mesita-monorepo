"use client";

import { useState } from "react";
import { CreditCard, ExternalLink } from "lucide-react";

import {
  apiGetPaymentDashboardLink,
  paymentsErrorCode,
} from "@/lib/api/payments";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS, INFO_BOX_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// The Express Dashboard door (MESITA-1532). Owners only — the EF is
// owner-gated and the link grants access to the account's money.
//
// Why this card exists at all: Mesita's connected accounts moved from the
// full Stripe Dashboard to the Express Dashboard, which has no public login
// for sandbox accounts. Without a platform-minted link the place cannot see a
// balance, change its payout bank account, or answer a dispute. This is the
// entrance.
//
// It opens the dashboard; it does not create accounts. Onboarding bakes a
// country in permanently and is staff-assisted today, so it stays where the
// country is chosen explicitly (admin Controls) rather than defaulted silently
// here.

export function PaymentsCard({ projectId }: { projectId: string }) {
  const supabase = useBrowserSupabase();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notOnboarded, setNotOnboarded] = useState(false);

  const open = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotOnboarded(false);
    try {
      const res = await apiGetPaymentDashboardLink(supabase, { projectId });
      if (!res.url) {
        // Mock account: there is no Stripe side to visit. Say that rather than
        // failing, because nothing is actually wrong.
        setError("Payments are in demo mode for this place — there's no Stripe dashboard to open yet.");
        return;
      }
      // New tab: the console page stays where it is, and the link is
      // single-use so there is nothing to come back to.
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      // A place that never onboarded is a normal state, not a fault.
      if (paymentsErrorCode(err) === "not_onboarded") {
        setNotOnboarded(true);
        return;
      }
      setError(errMsg(err, "Couldn't open the payments dashboard."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-card border-border flex items-start gap-3 rounded-2xl border p-4">
      <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <CreditCard className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-foreground text-sm font-semibold">Payments</h2>
        <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">
          Your balance, payouts, bank account and disputes live in your Stripe
          dashboard. Money from Mesita settles to you directly — Mesita never
          holds it.
        </p>

        {notOnboarded ? (
          <p className={cn(INFO_BOX_CLASS, "mt-3")}>
            Payments aren&apos;t set up for this place yet. Mesita sets this up
            with you — once it&apos;s done, this is where you&apos;ll get in.
          </p>
        ) : null}

        {error ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{error}</p> : null}

        <button
          type="button"
          onClick={() => void open()}
          disabled={busy}
          className={cn(PILL_BUTTON_CLASS, "mt-3 inline-flex items-center gap-1.5")}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {busy ? "Opening…" : "Open payments dashboard"}
        </button>
      </div>
    </section>
  );
}
