import { BarChart3, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

// Placeholder. The eventual dashboard surfaces platform-wide health —
// venue counts, claim/verification funnel, redemptions and discount
// volume, Atlas enrichment coverage, subscription MRR. Wired up later
// once the underlying metrics land; the route + sidebar entry exist now
// so the surface is reachable and we can iterate on the design.

export default function GlobalPerformancePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 pt-12 pb-14">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
        Overview · Performance
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        Global Performance
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
        Platform-wide health at a glance — venue coverage, the claim and
        verification funnel, discount volume, and subscription growth.
      </p>

      <section className="border-border bg-card mt-8 flex flex-col items-center gap-4 rounded-2xl border p-10 text-center">
        <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
          <BarChart3 className="h-5 w-5" />
        </span>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coming soon
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          We&apos;ll surface things like{" "}
          <span className="text-foreground font-medium">
            venues live
          </span>{" "}
          and{" "}
          <span className="text-foreground font-medium">
            discounts redeemed
          </span>{" "}
          here, trended over time. The metrics pipeline isn&apos;t wired
          yet — this page is a stub so the sidebar entry has somewhere to
          land.
        </p>
        <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
          <Sparkles className="h-3 w-3" />
          Soon
        </span>
      </section>
    </div>
  );
}
