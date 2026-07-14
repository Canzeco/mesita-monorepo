import { AlertTriangle, Gauge } from "lucide-react";
import {
  DEFAULT_SCORES_CONFIG as M,
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
// Scoring Config — ONE panel: the four lane equations, the hyperparameters,
// the 2×2 lane boards, and a bench of real sampled places. Nothing else.
//
// Every value is DERIVED from @/lib/business/scores and ./strategies, never
// restated — this page and the per-place Scores tab render the same source,
// and hand-copied knobs drift (see database.types.ts).
// ════════════════════════════════════════════════════════════════════════

export default async function ScoringConfigPage() {
  const sample = await sampleplaces();
  const places = sample.ok ? sample.places : [];
  const n = places.length;

  return (
    <section className="border-border bg-card shadow-card rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600">
            <Gauge className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Scoring
            </h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-relaxed">
              Four lanes × two match tiers. RIPM estimates, LIPM settles; zero
              match zeroes every lane — money can&apos;t buy irrelevance.
            </p>
          </div>
        </div>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold">
          Draft — drives nothing yet
        </span>
      </div>

      {/* ── The four lanes ──────────────────────────────────────────── */}
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {LANES.map((lane) => {
          const organic = lane.lane === "organic";
          return (
            <div
              key={lane.id}
              className={
                "rounded-xl border border-l-[3px] px-4 py-3 " +
                (organic
                  ? "border-border/60 border-l-sky-500 bg-sky-500/[0.03]"
                  : "border-border/60 border-l-pink-500 bg-pink-500/[0.03]")
              }
            >
              <p
                className={
                  "text-[10px] font-bold tracking-[0.13em] uppercase " +
                  (organic ? "text-sky-700" : "text-pink-700")
                }
              >
                {lane.lane} · {lane.mode}
              </p>
              <p className="mt-1.5 font-mono text-[15px] tracking-tight">
                {laneFormula(lane, "RIPM")}
                <span className="text-muted-foreground"> → </span>
                {laneFormula(lane, "LIPM")}
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                fast → slow · 0–{lane.max}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Definitions ─────────────────────────────────────────────── */}
      <div className="text-muted-foreground mt-3 flex flex-col gap-1 font-mono text-[11px] leading-relaxed">
        <p>
          {MATCH_TIERS.map((t) => `${t.term} = ${t.detail}`).join("  ·  ")}
          {"  ·  both 0–"}
          {MATCH_MAX}
        </p>
        <p>
          WW = where × when · where = 1/(1+(km/{M.distanceHalfKm})^
          {M.distanceExp}) · wait = 1/(1+(h/{M.waitHalfH})^{M.waitExp}) · fit =
          min(1, h/{M.sessionH}) · {TIME_BLOCK_H * 60}-min blocks
        </p>
        <p>
          P = {STRATEGIES.map((s) => `${PROMO_SCORE_BY_STRATEGY[s.id]} ${s.name}`).join(" · ")}
        </p>
        <p>
          intent/place data carry where/when as TEXT only — WW is the only
          numeric where/when, and it multiplies the match, never feeds it
        </p>
      </div>

      {/* ── The panel ───────────────────────────────────────────────── */}
      {n === 0 ? <EmptySample error={sample.ok ? null : sample.error} /> : <Simulator places={places} />}
    </section>
  );
}

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
