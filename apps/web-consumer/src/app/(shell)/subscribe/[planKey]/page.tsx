"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { PLANS } from "@/lib/consumer-data";
import { Spinner } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCreateSubscriptionCheckout } from "@/lib/api/subscription";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Premium subscribe page — the ONE door into Mesita Premium ($100 MXN/mo),
// wired to real Stripe Checkout. The legacy four-class subscribe routes
// collapsed to this single page; the [planKey] segment is kept so existing
// /subscribe/premium links resolve, but only "premium" is valid.
//
// THERE IS ONLY ONE WAY IN (decision: Pato, MESITA-1123). This page used to
// carry a "Three ways in" list offering Instagram and invitation alongside
// Subscribe — but those grant Silver and Diamond, which are CLASSES. Listing
// them on the plan page told a guest they could get Premium free, and merged
// the two axes on the one screen that takes their money. The class ladder is
// reachable from Me › Class; it is not a route to this.

// What the PLAN confers. Unlike a class (which moves the discount rate and
// nothing else), the subscription does carry product features — so this list
// is legitimate here and must never be mirrored onto a class card.
const PERKS = [
  "Higher discount rewards at every Verified Partner.",
  "Better, more rewarding recommendations across discovery.",
  "10 reservations every month.",
];

export default function SubscribePage() {
  // The segment is a PLAN key, not a class (Classes v2, MESITA-1079). The URL
  // is unchanged — "premium" was always the right word here — but it now names
  // the subscription axis rather than a rung, which is why the folder and the
  // lookup moved off CLASSES.
  const params = useParams<{ planKey: string }>();
  if (params?.planKey !== "premium") notFound();

  const premium = PLANS.find((p) => p.id === "premium");
  if (!premium) notFound();

  return (
    <div className="bg-background flex flex-1 flex-col overflow-y-auto">
      <header className="border-border bg-background/95 sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
        <Link
          href={CONSUMER_ROUTES.me}
          aria-label="Back to profile"
          className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-base font-semibold tracking-tight">
            Mesita Premium
          </h1>
          <p className="text-muted-foreground text-[11px]">
            ${premium.priceMxn.toLocaleString()} MXN / month · cancel anytime
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-5">
        <section className="bg-tier-premium shadow-elev rounded-2xl p-5 text-white">
          <p className="text-[10px] font-medium tracking-[0.16em] uppercase opacity-80">
            Mesita Plan
          </p>
          <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight">
            Mesita Premium
          </h2>
          <p className="mt-1 text-sm opacity-90">
            Higher discount rewards, better recommendations, 10 reservations.
          </p>
          <p className="font-display mt-4 text-4xl font-bold tabular-nums">
            ${premium.priceMxn.toLocaleString()}
            <span className="ml-1 text-base font-semibold opacity-80">
              MXN / mo
            </span>
          </p>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5">
          <h3 className="font-display text-base font-semibold tracking-tight">
            What you get
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <span className="bg-secondary/15 text-secondary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border bg-card rounded-2xl border p-5">
          <h3 className="font-display text-base font-semibold tracking-tight">
            Your class stays yours
          </h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Premium is a subscription, not a rung. It raises your discount at
            every place and never changes your class — Bronze, Silver, Gold and
            Diamond come from your follower count, or from an invitation Mesita
            sends by hand. Neither one can be bought.
          </p>
          <Link
            href={CONSUMER_ROUTES.me}
            className="text-primary mt-3 inline-flex text-sm font-semibold"
          >
            See your class
          </Link>
        </section>

        <section className="border-border bg-muted/30 text-muted-foreground rounded-2xl border border-dashed p-4 text-[12px] leading-relaxed">
          <p>
            You become Mesita Premium the moment payment clears — no spend
            accumulation needed. Cancel anytime; Premium stays through the end
            of the current billing period.
          </p>
        </section>

        <PremiumCheckoutButton />
      </div>
    </div>
  );
}

// Single toggle lives on the Edge Function (`MOCK_SUBSCRIPTION` env on
// consumer-web-create-subscription). Mock mode upserts a real subscription
// row and returns successUrl as checkout_url — the page always calls the EF.
function PremiumCheckoutButton() {
  const supabase = useBrowserSupabase();
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { checkout_url } = await apiCreateSubscriptionCheckout(supabase, {
        successUrl: `${origin}${CONSUMER_ROUTES.me}?subscription=success`,
        cancelUrl: `${origin}/subscribe/premium?subscription=cancelled`,
      });
      window.location.href = checkout_url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout",
      );
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void startCheckout()}
      disabled={loading}
      className="bg-pink-gradient shadow-glow inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold text-white disabled:opacity-70"
    >
      {loading ? (
        // White-on-gradient recolor of the brand ring.
        <Spinner size="sm" className="border-white/40 border-t-white" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {loading ? "Activating Premium…" : "Continue to checkout"}
    </button>
  );
}
