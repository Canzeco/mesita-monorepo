"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  ENGINE_POLICIES,
  laneScore,
  LANES,
  MATCH_MAX,
  whatScore,
  whenScore,
  whereScore,
  type EngineId,
  type Lane,
  type LaneId,
} from "@/lib/business/scores";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  cosineSim,
  EMBED_DIMS,
  embedText,
  generateIntent,
  haversineKm,
  lmCip,
  openWindow,
  rmFromVectors,
  SAMPLE_MAX,
  whatFits,
  type ConsumerProfile,
  type Intent,
  type SamplePlace,
} from "@/lib/business/cip";
import { strategyForPlace, type StrategyId } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { PanelCard } from "../panel-ui";

// Playground — the three engines, functional, no decorative UI. Real consumer
// (DB) + synthetic intent (generator) + real place (DB: rates, geo, hours) →
// the WIDE context documents are actually assembled (buildCiDoc /
// buildPlaceDoc — what the real RAG embeds and the judge reads), EMBEDDED
// into deterministic feature-hash vectors, and every sub-score is emulated:
//
//   RM-CIP  = cosine(CI vector, place vector) × 100 — the vectors are shown
//   LM-CIP  = RM + the judge's structured adjustments
//   WWW     = what(daypart) × where(km) × when(open-window) — numeric only
//   P       = posture from the live promo rates
//
// Fast screens top shortlist-n by the RM blend → Slow sorts by the LM blend.
// Hyperparameters come live from the Pipeline tab (shared provider).

type EngineRun = { profile: ConsumerProfile; intent: Intent };

type ScoredRow = {
  place: SamplePlace;
  placeDoc: string;
  placeVec: number[];
  rm: number;
  lm: number;
  what: number;
  where: number;
  when: number;
  www: number;
  km: number | null;
  hoursUnknown: boolean;
  promos: number;
  fastTotal: number;
  slowTotal: number;
};

type EngineResult = {
  ciDoc: string;
  ciVec: number[];
  kept: ScoredRow[];
  screened: number;
};

export function PlaygroundPanel() {
  const router = useRouter();
  const { consumers, places, cfg, mix, retrieval, promoVals } = useScoring();

  const [runs, setRuns] = useState<Partial<Record<EngineId, EngineRun>>>({});
  const [seed, setSeed] = useState(1);

  // Deterministic per click — reproducible runs, no Math.random in render scope.
  const generate = (engine: EngineId) => {
    const s = seed;
    setSeed((x) => x + 1);
    const offset = ENGINE_POLICIES.findIndex((e) => e.id === engine);
    const consumer = consumers.length > 0 ? consumers[(s * 7 + offset) % consumers.length] : null;
    const profile = buildConsumerProfile(consumer);
    const intent = generateIntent(engine, profile, places, s * 13 + offset * 5);
    setRuns((r) => ({ ...r, [engine]: { profile, intent } }));
  };

  // Place documents + vectors are intent-independent — build once per sample.
  const placeIndex = useMemo(
    () =>
      new Map(
        places.map((p) => {
          const doc = buildPlaceDoc(p);
          return [p.id, { doc, vec: embedText(doc) }];
        }),
      ),
    [places],
  );

  const maxPromo = Math.max(1, ...Object.values(promoVals));
  const dynMax = (lane: Lane) => (lane.lane === "inorganic" ? MATCH_MAX * maxPromo : MATCH_MAX);

  const blend = (engine: EngineId, laneVals: Record<LaneId, number>) =>
    LANES.reduce(
      (s, lane) =>
        s + ((mix[engine][lane.id] ?? 0) / 100) * (laneVals[lane.id] / dynMax(lane)) * 100,
      0,
    );

  const results = useMemo(() => {
    const out: Partial<Record<EngineId, EngineResult>> = {};
    for (const e of ENGINE_POLICIES) {
      const run = runs[e.id];
      if (!run) continue;
      const ci = [...run.profile.tasteTokens, ...run.intent.tokens];
      const cid = run.profile.consumer?.id ?? "synthetic";
      const ciDoc = buildCiDoc(run.profile, run.intent);
      const ciVec = embedText(ciDoc);

      const rows: ScoredRow[] = places.map((p) => {
        const pi =
          placeIndex.get(p.id) ?? { doc: buildPlaceDoc(p), vec: embedText(buildPlaceDoc(p)) };
        const rm = rmFromVectors(ciVec, pi.vec);
        const lm = lmCip(ci, p, cid, rm);
        const km =
          run.intent.lat != null && run.intent.lng != null && p.lat != null && p.lng != null
            ? haversineKm(run.intent.lat, run.intent.lng, Number(p.lat), Number(p.lng))
            : null;
        const win = openWindow(p.hours, run.intent.day, run.intent.hour);
        const what = whatScore(whatFits(p.category, run.intent.hour), cfg);
        const where = whereScore(km, cfg);
        const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);
        const promos =
          promoVals[
            strategyForPlace({
              welcome_free_rate: p.welcome_free_rate,
              welcome_premium_rate: p.welcome_premium_rate,
              free_rate: p.free_rate,
              premium_rate: p.premium_rate,
            }) as StrategyId
          ] ?? 0;

        const laneVals = (match: number) =>
          Object.fromEntries(
            LANES.map((lane) => [lane.id, laneScore(lane, { match, what, where, when, promos })]),
          ) as Record<LaneId, number>;

        return {
          place: p,
          placeDoc: pi.doc,
          placeVec: pi.vec,
          rm,
          lm,
          what,
          where,
          when,
          www: what * where * when,
          km,
          hoursUnknown: win.unknown,
          promos,
          fastTotal: blend(e.id, laneVals(rm)),
          slowTotal: blend(e.id, laneVals(lm)),
        };
      });

      const screened = [...rows].sort((a, b) => b.fastTotal - a.fastTotal);
      const kept = screened
        .slice(0, retrieval.shortlistN)
        .sort((a, b) => b.slowTotal - a.slowTotal);
      out[e.id] = { ciDoc, ciVec, kept, screened: Math.max(0, rows.length - retrieval.shortlistN) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, places, placeIndex, cfg, mix, promoVals, retrieval]);

  if (places.length === 0) {
    return (
      <PanelCard
        title="Playground"
        subtitle="Real consumer + synthetic intent + real place → ranked lists per engine."
      >
        <div
          role="status"
          className="border-amber-200/80 bg-amber-50 text-amber-950 mt-5 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">n = 0 — no places to score.</p>
            <p className="mt-0.5 text-xs text-amber-900/80">
              The playground draws a random sample of up to {SAMPLE_MAX} places from the catalog,
              and the catalog came back empty. The model still stands; there is simply nothing to
              run it on.
            </p>
          </div>
        </div>
      </PanelCard>
    );
  }

  return (
    <PanelCard
      title="Playground"
      subtitle={`${consumers.length} real consumer${consumers.length === 1 ? "" : "s"} · ${places.length} real places · synthetic intents. Context documents are assembled and embedded (${EMBED_DIMS}d feature-hash); RM-CIP is the cosine of the two vectors. Fast screens top ${retrieval.shortlistN} → Slow sorts.`}
      pill="emulated encoder + judge"
    >
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px] leading-snug">
          {consumers.length === 0
            ? "No consumers in the DB — runs use a labeled synthetic consumer."
            : "Generate picks a consumer, synthesizes an intent, builds the documents, embeds them, scores every place."}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="border-border/70 hover:bg-muted rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]"
        >
          Resample from DB
        </button>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {ENGINE_POLICIES.map((e) => {
          const run = runs[e.id];
          const res = results[e.id];
          return (
            <div key={e.id} className="border-border/60 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold">{e.engine}</p>
                  <p className="text-muted-foreground font-mono text-[10px]">
                    {e.id === "memo" ? "flexible intent · " : "fixed prompt structure · "}
                    {e.policy}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generate(e.id)}
                  className="bg-pink-gradient shadow-save rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
                >
                  Generate
                </button>
              </div>

              {!run || !res ? (
                <p className="text-muted-foreground mt-4 text-[12px]">
                  Generate to run: consumer → intent → documents → vectors → scores.
                </p>
              ) : (
                <>
                  {/* CI — the merged consumer+intent document, then its vector */}
                  <div className="bg-muted/50 border-border/60 mt-3 rounded-lg border px-3 py-2">
                    <p className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
                      CI document{run.profile.synthetic ? " · taste SYNTH" : ""}
                    </p>
                    <pre className="mt-1 font-mono text-[10.5px] leading-relaxed whitespace-pre-wrap">
                      {res.ciDoc}
                    </pre>
                  </div>
                  <div className="mt-2">
                    <p className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
                      CI embedding · {EMBED_DIMS}d
                    </p>
                    <VectorStrip vec={res.ciVec} className="mt-1" />
                  </div>

                  {/* The list — every sub-score emulated per place */}
                  <div className="mt-3 flex flex-col">
                    {res.kept.map((r, k) => (
                      <div key={r.place.id} className="border-border/40 border-b py-2 last:border-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-muted-foreground w-4 shrink-0 font-mono text-[11px] tabular-nums">
                            {k + 1}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate text-[12.5px] font-medium"
                            title={r.place.name}
                          >
                            {r.place.name}
                          </span>
                          <span className="font-mono text-[14px] font-semibold tabular-nums">
                            {r.slowTotal.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                          <ScoreChip label="RM" value={String(r.rm)} hint="cosine(CI, place) × 100" />
                          <ScoreChip label="LM" value={String(r.lm)} hint="RM + judge adjustments" />
                          <ScoreChip
                            label="WWW"
                            value={r.www.toFixed(2)}
                            hint={`what ${r.what.toFixed(2)} × where ${r.where.toFixed(2)} × when ${r.when.toFixed(2)}${r.hoursUnknown ? " (hours?)" : ""}${r.km != null ? ` · ${Math.round(r.km)} km` : ""}`}
                          />
                          <ScoreChip label="P" value={String(r.promos)} hint="posture from live rates" />
                          <span className="min-w-0 flex-1" />
                          <VectorStrip vec={r.placeVec} mini className="w-[72px] shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {res.screened > 0 ? (
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      Fast screened out {res.screened} below the top {retrieval.shortlistN}.
                    </p>
                  ) : null}

                  {/* The wide contexts, verbatim */}
                  <details className="mt-2">
                    <summary className="text-muted-foreground cursor-pointer text-[11px] font-semibold">
                      Context documents — what RAG embeds / the judge reads
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      {res.kept.map((r) => (
                        <div
                          key={r.place.id}
                          className="bg-muted/40 border-border/60 rounded-lg border px-3 py-2"
                        >
                          <p className="text-muted-foreground font-mono text-[9.5px]">
                            place doc · cos {cosineSim(res.ciVec, r.placeVec).toFixed(3)}
                          </p>
                          <pre className="mt-1 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
                            {r.placeDoc}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

// ── Local bits ─────────────────────────────────────────────────────────

function ScoreChip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <span
      title={hint}
      className="border-border/60 bg-muted/50 inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5"
    >
      <span className="text-muted-foreground font-mono text-[9px] font-bold">{label}</span>
      <span className="font-mono text-[11px] font-semibold tabular-nums">{value}</span>
    </span>
  );
}

/** A generated vector, drawn: bar height = |value|, color = sign. */
function VectorStrip({
  vec,
  mini,
  className = "",
}: {
  vec: number[];
  mini?: boolean;
  className?: string;
}) {
  const bins = mini ? 16 : 64;
  const step = Math.max(1, Math.floor(vec.length / bins));
  const vals: number[] = [];
  for (let i = 0; i < vec.length; i += step) vals.push(vec[i]);
  const max = Math.max(0.0001, ...vals.map((v) => Math.abs(v)));
  return (
    <div
      className={
        "bg-muted/40 border-border/50 flex items-end gap-px overflow-hidden rounded border px-0.5 pt-0.5 " +
        (mini ? "h-4" : "h-8") +
        " " +
        className
      }
      title={`${vec.length}d feature-hash embedding (emulated)`}
    >
      {vals.map((v, i) => (
        <span
          key={i}
          className={"w-full rounded-t-[1px] " + (v >= 0 ? "bg-sky-500/60" : "bg-pink-500/60")}
          style={{ height: `${Math.max(6, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
