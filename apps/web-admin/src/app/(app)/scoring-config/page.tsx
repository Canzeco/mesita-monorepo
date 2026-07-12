import { Braces, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// ════════════════════════════════════════════════════════════════════════
// Scoring Config — the GLOBAL side of scoring, read-only draft. Two cards:
//
//   Model     score = worth × fit ÷ decay(d). A great visit = a place worth
//             going to × a moment that fits ÷ a distance you'll cross.
//             WORTH is cached on the place; FIT is computed per query;
//             fit factors multiply so any zero kills the score — money
//             can't buy irrelevance, a closed club, or a bored regular.
//   Semantic  ALL matching is semantic (RAG/LLM) — there is no binary tag
//             search. What gets embedded, the two AI lanes, and how each
//             engine queries it.
//
// Everything becomes editable / backed by real vectors once the model ships.
// ════════════════════════════════════════════════════════════════════════

const WORTH_PARAMS = [
  { label: "Promotional Visibility", value: "0–10", hint: "bought · Promos" },
  { label: "Earned Reputation", value: "0–10", hint: "proven · stars × volume" },
  { label: "Magnetism", value: "0–10", hint: "desired · AI-judged" },
  { label: "Momentum", value: "×0.8–1.2", hint: "trending · velocity" },
];

const FIT_PARAMS = [
  { label: "Match", value: "0–1", hint: "meaning · RAG/LLM" },
  { label: "Right-now", value: "0–1", hint: "timing · hours + daypart" },
  { label: "Novelty", value: "0–1", hint: "per consumer · unseen floor" },
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

// Lane 1 — runs when the Enricher finishes a place (or an edit lands).
// Everything expensive happens here, cached as plain numbers on the place.
const ON_WRITE_LANE = [
  { step: "1", label: "Embed", detail: "fold the profile into one passage → place vector" },
  { step: "2", label: "Judge", detail: "LLM + vision score Magnetism 0–10 against a rubric" },
  { step: "3", label: "Refresh", detail: "Earned Reputation from fresh Google + IG numbers" },
  { step: "4", label: "Diff", detail: "Momentum from review/follower velocity vs last snapshot" },
];

// Lane 2 — runs on every engine request. Reads cached numbers; the only
// model call is the match judge on the recalled shortlist.
const PER_QUERY_LANE = [
  { step: "1", label: "Embed", detail: "the query — Memo's question, or the consumer's taste vector" },
  { step: "2", label: "Recall", detail: "cosine top-K over place vectors" },
  { step: "3", label: "Match", detail: "LLM judges the shortlist → match 0–1 per place" },
  { step: "4", label: "Score", detail: "worth × match × right-now × novelty ÷ decay" },
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

export default function ScoringConfigPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ── Model ────────────────────────────────────────────────────── */}
      <Card
        icon={<Megaphone className="h-4.5 w-4.5" />}
        chip="bg-pink-500/10 text-pink-600"
        title="Model"
        subtitle="A great visit = a place worth going to × a moment that fits ÷ a distance you'll actually cross."
        pill="Draft — read-only"
      >
        <div className="text-muted-foreground mt-5 flex flex-col gap-1 font-mono text-xs">
          <p>score = worth × fit ÷ (1 + distance/d₀)</p>
          <p>worth = (promotional visibility + reputation + magnetism) / 3 × momentum</p>
          <p>fit = match × right-now × novelty</p>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Worth adds — bought, proven and desired value compensate each other.
          Fit multiplies — any zero kills the score: money can&apos;t buy
          irrelevance, a closed club, or a consumer who&apos;s already swiped
          it away.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <GroupHead>Worth · the place — cached on write</GroupHead>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WORTH_PARAMS.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
          </div>
          <div>
            <GroupHead>Fit · the moment — per query</GroupHead>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FIT_PARAMS.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <GroupHead>Engine distance sensitivity · d₀</GroupHead>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
            {ENGINE_D0.map((k) => (
              <Knob key={k.label} {...k} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            The score halves every d₀ — each engine has its own appetite for
            distance.
          </p>
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
          <GroupHead>Lane 1 · on write — the Enricher finishes a place</GroupHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {ON_WRITE_LANE.map((s) => (
              <PipelineStep key={s.step} {...s} />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <GroupHead>Lane 2 · per query — every engine request</GroupHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {PER_QUERY_LANE.map((s) => (
              <PipelineStep key={s.step} {...s} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Expensive work lives in lane 1 and is cached as numbers; lane 2
            reads them and makes exactly one model call — the match judge on
            the recalled shortlist.
          </p>
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

function PipelineStep({
  step,
  label,
  detail,
}: {
  step: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5">
      <p className="text-muted-foreground text-[11px]">{step}</p>
      <p className="font-display mt-0.5 text-sm font-semibold tracking-tight">
        {label}
      </p>
      <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
        {detail}
      </p>
    </div>
  );
}
