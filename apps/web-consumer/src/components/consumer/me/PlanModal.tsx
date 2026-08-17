"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiCreateSubscriptionCheckout } from "@/lib/api/subscription";
import { useConsumerClass } from "@/lib/class-context";
import { PLANS, PREMIUM_PLAN_ICON } from "@/lib/consumer-data";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { toast } from "@/lib/toast";
import { SHEET_TITLE_CLASS, SHEET_BODY_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// The plan surface (decision: Pato, MESITA-1129) — a sheet on Me, built to the
// same shape as the class sheet: header, a ladder of the rungs, the actions
// underneath. Plan and class are two axes of one identity, so the two screens
// that explain them should not look like they came from different products.
//
// It replaced a ROUTE. /subscribe/premium was a full page with its own header
// and back arrow, which meant the two axes were a modal and a page — the plan
// felt like leaving the app to buy something, and the URL implied a funnel the
// product doesn't have. Everything the page did lives here; the route now 308s
// to /me.
//
// NO COLOUR BUT THE PLAN, mirroring the class sheet's rule. Premium wears
// `bg-tier-premium` (the token comment is explicit that this is the PLAN's
// colour now); Free is a bordered card. The checkout button is the one pink
// thing, because it is the only irreversible action on the surface.

// What the PLAN confers. Unlike a class — which moves the discount rate and
// nothing else — the subscription carries product features, so this list is
// legitimate here and must never be mirrored onto a class card.
//
// `soon` is not decoration on a checkout surface: two of these are not
// deliverable to a subscriber yet. Orders has no table, EF, type or quota
// anywhere in the repo, and the AI Connector box on Me is still parked.
// Un-park either one by deleting its flag here and there.
//
// THE +10 IS A REAL NUMBER, not a round one (decision: Pato — "be specific").
// It is the Premium column minus the Free column of the v11 visits grid, +10
// at every class on the CONSERVATIVE strategy:
//   bronze 10→20 · silver 15→25 · gold 20→30 · diamond 25→35
// Every live place runs conservative, so "every Mesita Partner" holds. Two
// config cases would break it, and both need this line revisited:
//   · an AGGRESSIVE place pays +20, so the claim would understate it
//   · a ZERO-strategy place runs no program at all, so there is no uplift
// The grid is operator-editable at Admin › Promos Config.
const PERKS: { label: string; soon?: boolean }[] = [
  { label: "+10% extra discount at every Mesita Partner" },
  { label: "Better recommendations" },
  { label: "10 reservations per month" },
  { label: "30 orders per month", soon: true },
  { label: "AI connector", soon: true },
];

export function PlanModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = useBrowserSupabase();
  const { plan, renewsAt } = useConsumerClass();
  const [loading, setLoading] = useState(false);

  const premium = PLANS.find((p) => p.id === "premium")!;
  const isPremium = plan === "premium";

  const renewalDate = renewsAt ? new Date(renewsAt) : null;
  const renewalValid =
    renewalDate != null && !Number.isNaN(renewalDate.valueOf());

  async function startCheckout() {
    setLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      // Both legs land back on Me — the surface the guest opened this from.
      // The old cancel URL pointed at /subscribe/premium, which no longer
      // exists; ProfileClient already toasts either query on arrival.
      const { checkout_url } = await apiCreateSubscriptionCheckout(supabase, {
        successUrl: `${origin}${CONSUMER_ROUTES.me}?subscription=success`,
        cancelUrl: `${origin}${CONSUMER_ROUTES.me}?subscription=cancelled`,
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
    <LocalSheet open={open} onClose={onClose} ariaLabel="Your plan">
      <div className={SHEET_BODY_CLASS}>
        <div className="mb-4 flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <PREMIUM_PLAN_ICON className="h-5 w-5" />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Your plan</h2>
            <p className="text-muted-foreground text-[12px]">
              A subscription, not a class. Cancel anytime.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* The two rungs, same shape as the class ladder. */}
          <ol className="flex flex-col gap-2">
            <li
              aria-current={!isPremium ? "true" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-3.5",
                !isPremium
                  ? "bg-muted shadow-sm"
                  : "border-border bg-card border",
              )}
            >
              <span className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <PREMIUM_PLAN_ICON className="text-muted-foreground h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] leading-tight font-bold tracking-tight">
                  Free
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-[12px] leading-snug">
                  Every account starts here
                </p>
              </div>
            </li>

            <li
              aria-current={isPremium ? "true" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl p-3.5",
                isPremium
                  ? "bg-tier-premium text-white shadow-sm"
                  : "border-border bg-card border",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  isPremium ? "bg-white/20" : "bg-muted",
                )}
              >
                <PREMIUM_PLAN_ICON
                  className={cn(
                    "h-[18px] w-[18px]",
                    !isPremium && "text-premium",
                  )}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[15px] leading-tight font-bold tracking-tight">
                  Premium
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[12px] leading-snug",
                    isPremium ? "opacity-90" : "text-muted-foreground",
                  )}
                >
                  {isPremium && renewalValid
                    ? `Renews ${renewalDate.toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}`
                    : `$${premium.priceMxn} MXN / month`}
                </p>
              </div>
            </li>
          </ol>

          <section className="border-border bg-card rounded-2xl border p-4">
            <h3 className="font-display text-sm font-semibold tracking-tight">
              What you get
            </h3>
            <ul className="mt-2.5 flex flex-col gap-2">
              {PERKS.map((p) => (
                <li
                  key={p.label}
                  className="flex items-center gap-2.5 text-[13px]"
                >
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

          {isPremium ? (
            <p className="border-border bg-muted/30 text-muted-foreground rounded-2xl border border-dashed p-4 text-[12px] leading-relaxed">
              You&rsquo;re on Premium. Cancel anytime from the receipt email —
              Premium stays through the end of the current billing period.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={loading}
              className="bg-pink-gradient flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loading ? "Starting checkout…" : "Continue to checkout"}
            </button>
          )}

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Premium is a subscription, not a class — your class still comes from
            followers or an invitation. You become Premium the moment payment
            clears.
          </p>
        </div>
      </div>
    </LocalSheet>
  );
}
