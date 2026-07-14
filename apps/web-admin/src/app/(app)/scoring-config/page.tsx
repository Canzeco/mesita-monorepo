import { AlertTriangle, Braces, Gauge } from "lucide-react";
import {
  DEFAULT_SCORES_CONFIG as M,
  ENGINE_POLICIES,
  laneFormula,
  LANES,
  MATCH_MAX,
  MATCH_TIERS,
  TIME_BLOCK_H,
} from "@/lib/business/scores";
import { PROMO_SCORE_BY_STRATEGY, STRATEGIES } from "@/lib/business/strategies";
import { sampleplaces, SAMPLE_MAX } from "./actions";
import { Simulator } from "./Simulator";

export const dynamic = "force-dynamic";

// ════════════════════════════════════════════════════════════════════════
// Scoring Config — the GLOBAL side of scoring. Two cards:
//
//   Model     FOUR LANES × TWO TIERS — {organic, inorganic} × {now, future},
//             each at Fast (RM) and Slow (LM); engines are pipeline policies.
//             Plus a live simulator over a random sample of real places.
//   Semantic  ALL matching is semantic (RAG/LLM) — there is no binary tag
//             search. What gets embedded, the two AI stages.
//
// Every value here is DERIVED from @/lib/business/scores and ./strategies,
// never restated — this page and the per-place Scores tab render the same
// source, and hand-copied knobs drift (see database.types.ts).
// ════════════════════════════════════════════════════════════════════════

// Now — the moment. Only the now-mode lanes see it.
const NOW_FACTORS = [
  { label: "where", value: `${M.distanceHalfKm} km`, hint: "half the pull · d₀" },
  { label: "wait", value: `${M.waitHalfH} h`, hint: "half the pull · a½" },
  { label: "fit", value: `${M.sessionH} h`, hint: "the visit needs · L" },
];

const ON_WRITE_STAGE = [
  { step: "1", label: "Embed", detail: "profile text → vector, stored on the place row" },
  { step: "2", label: "Promos", detail: "posture from the live rates → 0 · 1 · 2 · 3" },
];

const PER_QUERY_STAGE = [
  { step: "1", label: "Embed", detail: "the intent — prebuilt taste, or synthesized from the question" },
  { step: "2", label: "Recall", detail: "pgvector cosine top-K — RM comes free with recall" },
  { step: "3", label: "Judge", detail: `LM on the shortlist only → 0–${MATCH_MAX}` },
  { step: "4", label: "Rank", detail: "the lane the engine's policy asks for" },
];

const EMBEDDING_SPEC = [
  { label: "Model", value: "TBD", hint: "1,536 dims" },
  { label: "Recall", value: "top-K", hint: "pgvector cosine" },
  { label: "Judge", value: "1 call", hint: "on the shortlist" },
];

export default async function ScoringConfigPage() {
  const sample = await sampleplaces();
  const places = sample.ok ? sample.places : [];
  const n = places.length;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ── Model ────────────────────────────────────────────────────── */}
      <Card
        icon={<Gauge className="h-4.5 w-4.5" />}
        chip="bg-pink-500/10 text-pink-600"
        title="Model"
        subtitle="Four lanes that never compete: {organic, inorganic} × {now, future}. Match gates every one — money can't buy irrelevance — and the moment gates the now lanes."
        pill="Draft"
      >
        <div className="border-border/60 mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[460px] border-collapse font-mono text-xs">
            <thead>
              <tr className="text-muted-foreground border-border/60 border-b">
                <th className="px-3 py-2 text-left font-normal">lane</th>
                {MATCH_TIERS.map((t) => (
                  <th key={t.id} className="px-3 py-2 text-left font-normal">
                    {t.label} · {t.term}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-normal">ceiling</th>
              </tr>
            </thead>
            <tbody>
              {LANES.map((lane) => (
                <tr key={lane.id} className="border-border/60 border-b last:border-0">
                  <td className="text-muted-foreground px-3 py-2">
                    {lane.lane} {lane.mode}
                  </td>
                  <td className="px-3 py-2">{laneFormula(lane, "RM")}</td>
                  <td className="px-3 py-2 font-semibold">{laneFormula(lane, "LM")}</td>
                  <td className="text-muted-foreground px-3 py-2 text-right">0–{lane.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-muted-foreground mt-3 flex flex-col gap-1 font-mono text-xs">
          <p>WW = where × when</p>
          <p>&nbsp; where = 1 / (1 + (km / {M.distanceHalfKm})^{M.distanceExp})</p>
          <p>&nbsp; when&nbsp; = wait × fit &nbsp;·&nbsp; wait = 1 / (1 + (h / {M.waitHalfH})^{M.waitExp}) &nbsp;·&nbsp; fit = min(1, h / {M.sessionH})</p>
          <p>P&nbsp; = {STRATEGIES.map((s) => `${PROMO_SCORE_BY_STRATEGY[s.id]} ${s.name}`).join(" · ")}</p>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          The Slow column is the Fast column with LM swapped in for RM — nothing
          else moves, so the tiers only disagree where the estimators disagree.
          Each lane sorts only against itself; the inorganic lane <em>is</em>{" "}
          the organic lane × promos. Mode is a property of the query, not the
          place.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <GroupHead>Match · one question, two estimators</GroupHead>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-[19rem]">
              {MATCH_TIERS.map((t) => (
                <Knob key={t.id} label={t.label} value={t.term} hint={t.detail} />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Both 0–{MATCH_MAX}, and 0 is reachable — zero relevance zeroes
              every lane at either tier; that gate is the whole reason match
              multiplies instead of adds. RM estimates, LM settles.
            </p>
          </div>
          <div>
            <GroupHead>Now · the moment — now-mode lanes only</GroupHead>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {NOW_FACTORS.map((k) => (
                <Knob key={k.label} {...k} />
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Planning Saturday from the sofa, distance and hours are noise;
              choosing where to go in the next hour, they&apos;re most of the
              decision. <b>wait</b> is a delay cost and plateaus — five minutes
              is free, the cliff is where the plan dies. <b>fit</b> is not a
              decay at all but sufficiency: closing early costs nothing until
              you can&apos;t finish, and past L more hours add nothing. Time
              resolves to {TIME_BLOCK_H * 60}-minute blocks.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <GroupHead>Engines · pipeline policies — same table, different climb</GroupHead>
          <div className="mt-2 flex flex-col gap-2">
            {ENGINE_POLICIES.map((e) => (
              <div key={e.engine} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <p className="w-14 shrink-0 text-sm font-semibold">{e.engine}</p>
                <p className="text-muted-foreground font-mono text-xs">{e.policy}</p>
                <p className="text-muted-foreground text-xs">· intent: {e.intent}</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Engines never get their own formula — they pick a lane and decide
            how far up the fidelity ladder to climb. Swipe&apos;s screen uses
            the <em>full</em> Fast lane (WW and P included), so no Slow calls
            are wasted on closed or far places. The only per-engine input
            difference is intent-data; place-data is always prebuilt by the
            Enricher.
          </p>
        </div>

        {n === 0 ? (
          <EmptySample error={sample.ok ? null : sample.error} />
        ) : (
          <Simulator places={places} />
        )}
      </Card>

      {/* ── Semantic — the whole RAG side in one box ─────────────────── */}
      <Card
        icon={<Braces className="h-4.5 w-4.5" />}
        chip="bg-indigo-500/10 text-indigo-600"
        title="Semantic"
        subtitle="There is no binary tag search — all matching is meaning, powered by LLMs. Tags only enrich the embedding text; the moment is a separate multiplier, outside relevance."
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
          <GroupHead>Stage 1 · on write — the Enricher finishes a place</GroupHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ON_WRITE_STAGE.map((s) => (
              <PipelineStep key={s.step} {...s} />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <GroupHead>Stage 2 · per query — every engine request</GroupHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {PER_QUERY_STAGE.map((s) => (
              <PipelineStep key={s.step} {...s} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Expensive work lives in stage 1 and is cached as numbers; stage 2
            makes at most one model call — the LM judge on the recalled
            shortlist, and only when the engine&apos;s policy climbs that far.
            Which engines climb lives on the Model card above.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

/** n = 0 — say so plainly rather than rendering an empty matrix. */
function EmptySample({ error }: { error: string | null }) {
  return (
    <div
      role="status"
      className="border-amber-200/80 bg-amber-50 text-amber-950 mt-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">n = 0 — no examples to show.</p>
        <p className="mt-0.5 text-xs text-amber-900/80">
          {error
            ? `The catalog couldn't be read: ${error}`
            : `The simulator draws a random sample of up to ${SAMPLE_MAX} places from the catalog, and the catalog came back empty. The model above still stands; there is simply nothing to run it on.`}
        </p>
      </div>
    </div>
  );
}

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

function Knob({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5 text-center">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="font-display mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      <p className="text-muted-foreground text-[11px]">{hint}</p>
    </div>
  );
}

function PipelineStep({ step, label, detail }: { step: string; label: string; detail: string }) {
  return (
    <div className="bg-muted/60 border-border/60 rounded-xl border px-3 py-2.5">
      <p className="text-muted-foreground text-[11px]">{step}</p>
      <p className="font-display mt-0.5 text-sm font-semibold tracking-tight">{label}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{detail}</p>
    </div>
  );
}
