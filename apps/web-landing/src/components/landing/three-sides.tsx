import { Store, UserCircle, Utensils } from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

// The market map. The third column is the twist — no competitor can write
// "we serve places that never sign up" — so it gets the visual weight.
function ThreeSides() {
  return (
    <section id="sides" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Three sides"
          title="Three sides of the table."
          aside="Mesita serves the whole city — including the places that never sign up."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6">
            <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
              <UserCircle className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Guests
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The whole night in one app: discover, book, order pickup, pay less
              on every visit — and pay in Credits.
            </p>
          </article>
          <article className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6">
            <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Partner restaurants
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Demand with nothing to install: a verified profile, exclusive
              rewards, priority placement and the dashboard. No hardware, no
              integration, no commission.
            </p>
          </article>
          <article className="border-primary/50 relative flex flex-col gap-3 rounded-2xl border-[1.5px] bg-gradient-to-b from-[oklch(0.971_0.014_5)] to-white p-6 shadow-[0_18px_44px_-18px_oklch(0.65_0.24_5/0.28)]">
            <span className="text-secondary absolute top-5 right-5 text-[10px] font-bold tracking-[0.1em] uppercase">
              The twist
            </span>
            <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
              <Utensils className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Every other restaurant
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Listed, enriched, bookable and orderable from day one — without
              ever signing up. They get guests; Mesita gets completeness.
            </p>
          </article>
        </div>
        <p className="text-muted-foreground mt-10 text-center text-sm">
          For every{" "}
          <span className="font-display text-foreground text-3xl font-semibold tracking-tight">
            ~100
          </span>{" "}
          listed places,{" "}
          <span className="font-display text-foreground text-3xl font-semibold tracking-tight">
            1
          </span>{" "}
          paying partner makes the model work.
        </p>
      </div>
    </section>
  );
}

export { ThreeSides };
