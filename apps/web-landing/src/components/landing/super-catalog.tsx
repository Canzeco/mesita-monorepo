import { CheckCircle2 } from "lucide-react";

const MOSAIC = [
  {
    name: "Mission Taqueria",
    meta: "Tacos · Mission",
    tone: "bg-pink-gradient",
  },
  { name: "Fog Harbor Café", meta: "Café · Embarcadero", tone: "bg-gold" },
  {
    name: "North Beach Trattoria",
    meta: "Italian · North Beach",
    tone: "bg-brand",
  },
];

const GUARANTEES = [
  "No onboarding",
  "No sales team",
  "No hardware",
  "No integration",
];

// The moat section. One card renders mid-enrichment so the pipeline is
// visible as a mechanism, not a claim.
function SuperCatalog() {
  return (
    <section id="catalog" className="border-border border-b">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-5">
          <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
            The catalog is the moat
          </p>
          <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
            Every restaurant, café and bar in California — on Mesita the day it
            opens.
          </h2>
          <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
            The catalog builds itself from Google and the open web, and the
            Enricher maintains every profile on its own: photos, menus, hours,
            reviews, vibe. The most complete catalog in the market — before a
            single restaurant signs up.
          </p>
          <div className="flex flex-wrap gap-2">
            {GUARANTEES.map((g) => (
              <span
                key={g}
                className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
              >
                <CheckCircle2
                  className="text-secondary h-3.5 w-3.5"
                  aria-hidden
                />
                {g}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {MOSAIC.map((m) => (
            <div
              key={m.name}
              className="border-border bg-card flex flex-col gap-2 rounded-2xl border p-3.5"
            >
              <div className={`h-16 rounded-xl ${m.tone} opacity-80`} />
              <p className="text-[13px] leading-tight font-semibold">
                {m.name}
              </p>
              <p className="text-muted-foreground text-[11px]">{m.meta}</p>
            </div>
          ))}
          <div className="border-primary/40 bg-card flex flex-col gap-2 rounded-2xl border border-dashed p-3.5">
            <div className="bg-muted h-16 animate-pulse rounded-xl" />
            <div className="bg-muted h-2.5 w-3/4 rounded-full" />
            <div className="bg-muted h-2 w-1/2 rounded-full" />
            <p className="text-secondary text-[11px] font-semibold">
              Enriching — menu · photos · vibe
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export { SuperCatalog };
