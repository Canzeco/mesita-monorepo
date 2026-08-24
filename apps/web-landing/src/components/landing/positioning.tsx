import { SectionHeader } from "@/components/landing/section-header";

const CORNERS = [
  { label: "Demand", who: "OpenTable · TheFork · Clubers", sells: true },
  { label: "Software", who: "Toast · SevenRooms", sells: false },
  { label: "Capital", who: "inKind", sells: true },
];

function Positioning() {
  return (
    <section id="positioning" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Positioning"
          title="Everyone sells restaurants one of three things."
          aside="Mesita starts as demand, becomes the rail, and ends up selling capital."
        />
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CORNERS.map((c) => (
            <article
              key={c.label}
              className={`flex flex-col gap-2 rounded-2xl border p-6 ${
                c.sells
                  ? "border-primary/40 bg-card"
                  : "border-border bg-muted/40"
              }`}
            >
              <h3
                className={`font-display text-lg font-semibold tracking-tight ${
                  c.sells ? "" : "text-muted-foreground line-through"
                }`}
              >
                {c.label}
              </h3>
              <p className="text-muted-foreground text-sm">{c.who}</p>
              <p
                className={`mt-1 text-[11px] font-bold tracking-[0.1em] uppercase ${
                  c.sells ? "text-secondary" : "text-muted-foreground"
                }`}
              >
                {c.sells ? "Mesita sells this" : "Mesita never sells this"}
              </p>
            </article>
          ))}
        </div>
        <p className="text-muted-foreground mx-auto mt-10 max-w-3xl text-center text-base leading-relaxed">
          TheFork proved the consumer mechanics at global scale; inKind proved
          the capital model.{" "}
          <span className="text-foreground font-medium">
            Nobody has stacked them on a catalog that builds itself.
          </span>
        </p>
      </div>
    </section>
  );
}

export { Positioning };
