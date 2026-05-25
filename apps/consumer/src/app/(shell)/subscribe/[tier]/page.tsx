import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { TIERS } from "@/lib/consumer-data";

// Placeholder subscribe-confirmation page. The class IS the brand here —
// "Mesita Silver" / "Mesita Gold" / "Mesita Diamond". Wires up later to
// Stripe Checkout once recurring consumer products exist. For now this page
// stops at the "Continue to checkout" CTA and explains what the consumer is
// signing up for.

export const dynamic = "force-dynamic";

const PAID_TIERS = ["silver", "gold", "diamond"] as const;
type PaidTier = (typeof PAID_TIERS)[number];

const COPY: Record<
  PaidTier,
  {
    tagline: string;
    perks: string[];
  }
> = {
  silver: {
    tagline: "More cashback at every Verified Partner.",
    perks: [
      "Elevated cashback rate at all Formal partners.",
      "Elevated discount at all Informal partners.",
      "Insider perks at participating venues.",
    ],
  },
  gold: {
    tagline: "Premium rates and priority across discovery.",
    perks: [
      "Premium cashback / discount rate at every partner.",
      "Priority placement in your own swipe and AI suggestions.",
      "Early access to new partners in your city.",
    ],
  },
  diamond: {
    tagline: "VIP treatment, private events, top rates.",
    perks: [
      "Top cashback / discount rate at every partner.",
      "Invitations to private partner events.",
      "Concierge appeal channel for special requests.",
    ],
  },
};

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ tier: string }>;
}) {
  const { tier } = await params;
  if (!PAID_TIERS.includes(tier as PaidTier)) notFound();
  const paid = tier as PaidTier;
  const meta = TIERS.find((t) => t.id === paid);
  if (!meta) notFound();
  const copy = COPY[paid];
  const brand = `Mesita ${meta.label}`;

  return (
    <div className="bg-background flex flex-1 flex-col overflow-y-auto">
      <header className="border-border bg-background/95 sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
        <Link
          href="/profile"
          aria-label="Back to profile"
          className="bg-muted text-foreground hover:bg-muted/70 flex h-9 w-9 items-center justify-center rounded-full transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-base font-semibold tracking-tight">
            Subscribe to {brand}
          </h1>
          <p className="text-muted-foreground text-[11px]">
            ${meta.priceMxn.toLocaleString()} MXN / month · cancel anytime
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-5 py-5">
        <section
          className={
            paid === "silver"
              ? "bg-tier-silver rounded-2xl p-5 text-zinc-900 shadow-sm"
              : paid === "gold"
                ? "bg-tier-gold rounded-2xl p-5 text-black shadow-sm"
                : "bg-tier-diamond shadow-elev rounded-2xl p-5 text-white"
          }
        >
          <p className="text-[10px] font-medium tracking-[0.16em] uppercase opacity-80">
            Mesita Class
          </p>
          <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight">
            {brand}
          </h2>
          <p className="mt-1 text-sm opacity-90">{copy.tagline}</p>
          <p className="font-display mt-4 text-4xl font-bold tabular-nums">
            ${meta.priceMxn.toLocaleString()}
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
            {copy.perks.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <span className="bg-secondary/15 text-secondary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3 w-3" />
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-border bg-muted/30 text-muted-foreground rounded-2xl border border-dashed p-4 text-[12px] leading-relaxed">
          <p>
            Granted upfront — you become {brand} the moment payment clears, no
            spend accumulation needed. Cancel anytime; your class stays through
            the end of the current billing period.
          </p>
        </section>

        <button
          type="button"
          disabled
          className="bg-pink-gradient shadow-glow inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-70"
        >
          <Sparkles className="h-4 w-4" />
          Continue to checkout (coming soon)
        </button>
        <p className="text-muted-foreground text-center text-[11px]">
          Stripe Checkout for consumer subscriptions ships next. The page UI is
          live so the rest of the app can link here.
        </p>
      </div>
    </div>
  );
}
