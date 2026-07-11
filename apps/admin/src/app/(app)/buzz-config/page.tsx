import { Braces, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// ════════════════════════════════════════════════════════════════════════
// Buzz Config — the GLOBAL side of Buzz, read-only draft. Two cards:
//
//   Model     score = (promotional visibility + organic importance) × match
//             ÷ decay(d). Match multiplies so zero relevance zeroes the
//             score — money can't buy irrelevance.
//   Semantic  ALL matching is semantic (RAG/LLM) — there is no binary tag
//             search. One box: what gets embedded, the spec, the pipeline,
//             and how each engine queries it.
//
// Everything becomes editable / backed by real vectors once the model ships.
// ════════════════════════════════════════════════════════════════════════

const IMPORTANCE_WEIGHTS = [
  { label: "Google stars", value: "≤ 6 pts", hint: "rating / 5 × 6" },
  { label: "Review volume", value: "≤ 3 pts", hint: "log — 5,000 maxes it" },
  { label: "Social proof", value: "≤ 1 pt", hint: "IG followers, log" },
];

const ENGINE_D0 = [
  { label: "Swipe", value: "1.5 km", hint: "most local" },
  { label: "Map", value: "3 km", hint: "mid-range" },
  { label: "Memo", value: "5 km", hint: "meaning first" },
];

const EMBEDDING_SPEC = [
  { label: "Vector", value: "1,536 d", hint: "one per place" },
  { label: "Recall", value: "cosine", hint: "pgvector top-K" },
  { label: "Refresh", value: "on write", hint: "Enricher + edits" },
];

// No metadata-filter step: matching is semantic end to end. The only
// non-semantic survivors are reality gates — open now + radius.
const PIPELINE = [
  {
    step: "1",
    label: "Embed",
    detail: "the query — Memo's question, or the consumer's taste vector",
  },
  { step: "2", label: "Recall", detail: "cosine top-K over place vectors" },
  {
    step: "3",
    label: "Match",
    detail: "LLM judges the shortlist → match 0–1 per place",
  },
  {
    step: "4",
    label: "Score",
    detail: "(PV + OI) × match ÷ decay orders what's left",
  },
];

const ENGINE_RECIPES = [
  {
    label: "Memo",
    recipe: "The query is the question — full RAG, meaning does the heavy lifting.",
  },
  {
    label: "Swipe",
    recipe: "The query is the person — the consumer's taste embedding from likes, visits and profile.",
  },
  {
    label: "Map",
    recipe: "Taste embedding inside the viewport; typing on the map swaps the query to the text.",
  },
];

export default function BuzzConfigPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ── Model ────────────────────────────────────────────────────── */}
      <Card
        icon={<Megaphone className="h-4.5 w-4.5" />}
        chip="bg-pink-500/10 text-pink-600"
        title="Model"
        subtitle="One score per place per query — potency × semantic match, divided by distance."
        pill="Draft — read-only"
      >
        <p className="text-muted-foreground mt-5 font-mono text-xs">
          score = (promotional visibility + organic importance) × match ÷ (1 +
          distance/d₀)
        </p>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Match (0–1) multiplies — a place that means nothing to the query
          scores zero no matter what it paid. Bought and earned worth add;
          relevance gates.
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <GroupHead>Organic importance weights · 1–10</GroupHead>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {IMPORTANCE_WEIGHTS.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Promotional visibility (the other 10) is the live Promos score —
              configured per place on its Promos tab.
            </p>
          </div>

          <div>
            <GroupHead>Engine distance sensitivity · d₀</GroupHead>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ENGINE_D0.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Potency halves every d₀ — each engine has its own appetite for
              distance.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Semantic — the whole RAG side in one box ─────────────────── */}
      <Card
        icon={<Braces className="h-4.5 w-4.5" />}
        chip="bg-indigo-500/10 text-indigo-600"
        title="Semantic"
        subtitle="There is no binary tag search — all matching is meaning, powered by LLMs. Tags only enrich the embedding text; the only non-semantic gates are reality: open now + radius."
        pill="Mock — no vectors yet"
      >
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <GroupHead>Embedding text · per place</GroupHead>
            <p className="bg-muted/60 border-border/60 mt-2 rounded-xl border px-4 py-3 font-mono text-xs leading-relaxed">
              {"{name}"} — {"{category}"} in {"{zone}"}, {"{city}"}.{" "}
              {"{description}"}
              <br />
              Tags: {"{tags…}"} · Price: {"{price_level}"} · Best for:{" "}
              {"{dayparts}"}
            </p>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              The Enricher writes the description and tags; the template folds
              them into one passage per place, re-embedded whenever the profile
              changes.
            </p>
          </div>

          <div>
            <GroupHead>Embedding spec</GroupHead>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {EMBEDDING_SPEC.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Stored next to the place row — recall and scoring run in the same
              query.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <GroupHead>Pipeline · every engine query walks it</GroupHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {PIPELINE.map((s) => (
              <div
                key={s.step}
                className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5"
              >
                <p className="text-muted-foreground text-[11px]">{s.step}</p>
                <p className="font-display mt-0.5 text-sm font-semibold tracking-tight">
                  {s.label}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  {s.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <GroupHead>Per engine — there is always a query</GroupHead>
          <div className="mt-2 flex flex-col gap-2">
            {ENGINE_RECIPES.map((e) => (
              <div key={e.label} className="flex items-baseline gap-3">
                <p className="w-14 shrink-0 text-sm font-semibold">{e.label}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {e.recipe}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function Card({
  icon,
  chip,
  title,
  subtitle,
  pill,
  children,
}: {
  icon: React.ReactNode;
  chip: string;
  title: string;
  subtitle: string;
  pill: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
              chip
            }
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold">
          {pill}
        </span>
      </div>
      {children}
    </section>
  );
}

function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
      {children}
    </p>
  );
}

function Knob({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}
