import {
  Bot,
  CheckCircle2,
  Map,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// Citywide Discovery. The catalog and the doors into it are ONE section now:
// the earlier page split them into "the moat" and "eight engines", and a
// guest does not care that they are two systems. Three doors, on Pato's
// cut (2026-09-28): Scroll · Map · Ask.
const DOORS: { name: string; note: string; Icon: LucideIcon }[] = [
  { name: "Scroll", note: "today’s deck, one place at a time", Icon: Sparkles },
  { name: "Map", note: "the whole city, live", Icon: Map },
  { name: "Ask", note: "tell Memo what fits tonight", Icon: MessageCircle },
];

// The mechanism, as the numbers Pato dictated for the page.
const FACTS = [
  {
    label: "Sourced, not submitted",
    body: "Google Places, Instagram, the website, and the open web, merged into one profile.",
  },
  {
    label: "30 cents a place",
    body: "A whole city for the price of one billboard.",
  },
  {
    label: "Ten minutes a city",
    body: "The top 1,000 places in one run, and every new opening after that.",
  },
];

const SOURCES = ["Google", "Instagram", "website", "reviews"];

function Discovery() {
  return (
    <section id="discovery" className="border-border border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              Citywide Discovery · every place, day one
            </p>
            <h2 className="font-display max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
              Every restaurant in the city is already on Mesita.
            </h2>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              Nobody types a place into Mesita. Enrichment AI agents find it and
              build the profile themselves, from Google Places, the place’s
              Instagram, its website, and everything else the open web says
              about it: photos, menu, hours, reviews, vibe. The profile is
              dynamic, so it keeps rebuilding itself as the place changes.
            </p>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              A profile costs about{" "}
              <span className="text-foreground font-medium">30 US cents</span>{" "}
              to build. That is the whole trick: the top 1,000 places of any
              city, built in one run, in about ten minutes, before a single one
              of them has heard of Mesita.
            </p>
          </div>

          {/* One profile mid-enrichment, so the pipeline is visible as a
              mechanism rather than a claim. */}
          <div className="border-primary/40 bg-card shadow-elev flex flex-col gap-4 rounded-3xl border border-dashed p-6">
            <div className="flex items-center gap-3">
              <span className="bg-pink-gradient flex h-10 w-10 items-center justify-center rounded-2xl text-white">
                <Bot className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">Enrichment agent</p>
                <p className="text-secondary text-[11px] font-semibold">
                  Enriching · menu · photos · vibe
                </p>
              </div>
            </div>
            <div className="bg-muted h-28 animate-pulse rounded-2xl" />
            <div className="bg-muted h-2.5 w-3/4 rounded-full" />
            <div className="bg-muted h-2 w-1/2 rounded-full" />
            <div className="flex flex-wrap gap-2 pt-1">
              {SOURCES.map((s) => (
                <span
                  key={s}
                  className="border-border bg-background text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  <CheckCircle2
                    className="text-secondary h-3.5 w-3.5"
                    aria-hidden
                  />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DOORS.map(({ name, note, Icon }) => (
            <div
              key={name}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3.5"
            >
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-semibold">
                  {name}
                </span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {note}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FACTS.map(({ label, body }) => (
            <div
              key={label}
              className="border-border bg-muted/30 flex flex-col gap-1 rounded-2xl border px-5 py-4"
            >
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Discovery };
