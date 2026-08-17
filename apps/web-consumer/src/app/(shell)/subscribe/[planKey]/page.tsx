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

// What the PLAN confers (decision: Pato, MESITA-1127). Unlike a class — which
// moves the discount rate and nothing else — the subscription carries product
// features, so this list is legitimate here and must never be mirrored onto a
// class card.
//
// `soon` is not decoration on this page: it is a checkout screen, and two of
// these are not deliverable to a subscriber yet. Orders has no table, EF,
// type or quota anywhere in the repo, and the AI Connector box on Me is still
// parked. Un-park either one by deleting its flag here and there.
const PERKS: { label: string; soon?: boolean }[] = [
  { label: "Bigger discounts at Verified Partners" },
  { label: "Better recommendations" },
  { label: "10 reservations per month" },
  { label: "30 orders per month", soon: true },
  { label: "AI connector", soon: true },
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
          {/* The hero used to list three perks the card below then listed
              again. It states the offer; the list states the contents. */}
          <p className="mt-1 text-sm opacity-90">
            More off every bill, cancel anytime.
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
              <li key={p.label} className="flex items-center gap-2.5 text-sm">
                <span className="bg-secondary/15 text-secondary flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span className={p.soon ? "text-muted-foreground" : undefined}>
                  {p.label}
                </span>
                {p.soon && (
                  <span className="border-border text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] uppercase">
                    Soon
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* The class note earns one line, not a section. It still has to be
            here — this is the screen where a guest is most likely to read
            Premium as a rung — but a heading, a paragraph and a link competed
            with the CTA to say one sentence. */}
        <section className="border-border bg-muted/30 text-muted-foreground rounded-2xl border border-dashed p-4 text-[12px] leading-relaxed">
          <p>
            Premium is a subscription, not a class — your class still comes
            from followers or an invitation.{" "}
            <Link href={CONSUMER_ROUTES.me} className="text-primary font-semibold">
              See your class
            </Link>
          </p>
          <p className="mt-2">
            You become Mesita Premium the moment payment clears. Cancel anytime;
            Premium stays through the end of the current billing period.
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
