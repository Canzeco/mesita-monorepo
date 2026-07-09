"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Check, Instagram, Mail, Sparkles } from "lucide-react";
import { CLASSES } from "@/lib/consumer-data";
import { Spinner } from "@/components/shared/Spinner";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCreateSubscriptionCheckout } from "@/lib/api/subscription";
import { MOCK_PREMIUM_KEY } from "@/lib/class-context";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Premium subscribe page — the paid "door" into Mesita Premium ($100 MXN/mo).
// The other two doors (Instagram, invitation) are surfaced here too so the
// page reads as "here's how to get Premium", with Subscribe as the primary
// action wired to real Stripe Checkout. The legacy four-class subscribe routes
// collapsed to this single page; the [classKey] segment is kept so existing
// /subscribe/premium links resolve, but only "premium" is valid.

const PERKS = [
  "Bigger discounts at every Verified Partner.",
  "Better, more rewarding recommendations across discovery.",
  "Unlimited reservations every month.",
];

export default function SubscribePage() {
  const params = useParams<{ classKey: string }>();
  if (params?.classKey !== "premium") notFound();

  const premium = CLASSES.find((c) => c.id === "premium");
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
            Mesita Class
          </p>
          <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight">
            Mesita Premium
          </h2>
          <p className="mt-1 text-sm opacity-90">
            Better rewards, better recommendations, unlimited reservations.
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
            Three ways in
          </h3>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,oklch(0.70_0.20_30),oklch(0.65_0.20_350))] text-white">
                <Instagram className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-semibold">Instagram</span> — 1,000+
                followers and post a story. Premium, free.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <Mail className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-semibold">Invitation</span> — for locals,
                influencers, and talent picked by Mesita.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="bg-pink-gradient mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-semibold">Subscribe</span> — $
                {premium.priceMxn} MXN / mo, below. Cancel anytime.
              </span>
            </li>
          </ul>
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

// While billing is mocked, the button skips Stripe and flips the client-side
// Premium flag instead. Set false to restore the real
// consumer-create-subscription → Stripe Checkout flow below.
const MOCK_SUBSCRIPTION = true;

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

  // Mock path: no Stripe, no DB write. Persist the Premium flag and hard-reload
  // into the profile success state so the class provider re-seeds Premium.
  function mockSubscribe() {
    setLoading(true);
    window.localStorage.setItem(MOCK_PREMIUM_KEY, "1");
    window.location.href = `${CONSUMER_ROUTES.me}?subscription=success`;
  }

  return (
    <button
      type="button"
      onClick={MOCK_SUBSCRIPTION ? mockSubscribe : startCheckout}
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
