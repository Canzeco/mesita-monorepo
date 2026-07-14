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
  buildConsumerProfile,
  generateIntent,
  haversineKm,
  lmCip,
  openWindow,
  rmCip,
  whatFits,
  type ConsumerProfile,
  type Intent,
  type SamplePlace,
} from "@/lib/business/cip";
import { strategyForPlace, type StrategyId } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { PanelCard } from "../panel-ui";
import { SAMPLE_MAX } from "@/lib/business/cip";

// Playground — the three engines, functional, no decorative UI. Real consumer
// (DB) + synthetic intent (generator) + real place (DB: rates, geo, hours) →
// RM-CIP / LM-CIP / WW / P → Fast screens top shortlist-n → Slow sorts → just
// the ranked list. Hyperparameters come live from the Params tab (shared
// provider); lists recompute as knobs move.

type EngineRun = { profile: ConsumerProfile; intent: Intent };

type ScoredRow = {
  place: SamplePlace;
  rm: number;
  lm: number;
  what: number;
  where: number;
  when: number;
  km: number | null;
  hoursUnknown: boolean;
  promos: number;
  fastTotal: number;
  slowTotal: number;
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

  const maxPromo = Math.max(1, ...Object.values(promoVals));
  const dynMax = (lane: Lane) => (lane.lane === "inorganic" ? MATCH_MAX * maxPromo : MATCH_MAX);

  const blend = (engine: EngineId, laneVals: Record<LaneId, number>) =>
    LANES.reduce(
      (s, lane) =>
        s + ((mix[engine][lane.id] ?? 0) / 100) * (laneVals[lane.id] / dynMax(lane)) * 100,
      0,
    );

  const results = useMemo(() => {
    const out: Partial<Record<EngineId, { kept: ScoredRow[]; screened: number }>> = {};
    for (const e of ENGINE_POLICIES) {
      const run = runs[e.id];
      if (!run) continue;
      const ci = [...run.profile.tasteTokens, ...run.intent.tokens];
      const cid = run.profile.consumer?.id ?? "synthetic";

      const rows: ScoredRow[] = places.map((p) => {
        const rm = rmCip(ci, p);
        const lm = lmCip(ci, p, cid);
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
          rm,
          lm,
          what,
          where,
          when,
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
      out[e.id] = { kept, screened: Math.max(0, rows.length - retrieval.shortlistN) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, places, cfg, mix, promoVals, retrieval]);

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
      subtitle={`${consumers.length} real consumer${consumers.length === 1 ? "" : "s"} · ${places.length} real places · synthetic intents. Fast screens top ${retrieval.shortlistN} → Slow sorts. Lists recompute live with the Params tab.`}
      pill="RM/LM = heuristic stand-ins"
    >
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px] leading-snug">
          {consumers.length === 0
            ? "No consumers in the DB — runs use a labeled synthetic consumer."
            : "Generate picks a consumer, synthesizes an intent, scores every place."}
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
                  Generate to run: pick a consumer, synthesize an intent, score every place.
                </p>
              ) : (
                <>
                  {/* The C and the I of CIP */}
                  <div className="bg-muted/50 border-border/60 mt-3 rounded-lg border px-3 py-2">
                    <p className="font-mono text-[10.5px]">
                      <span className="text-muted-foreground">C · </span>
                      {run.profile.consumer?.label ?? "—"} ·{" "}
                      {run.profile.consumer?.class_key ?? "synthetic"}
                      {run.profile.synthetic ? (
                        <span className="text-amber-700"> · taste SYNTH</span>
                      ) : null}
                      <span className="text-muted-foreground">
                        {" "}
                        [{run.profile.tasteTokens.slice(0, 5).join(", ")}]
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[10.5px]">
                      <span className="text-muted-foreground">I · </span>
                      {run.intent.text}
                    </p>
                  </div>

                  {/* Just the list */}
                  <div className="mt-2.5 flex flex-col">
                    {res.kept.map((r, k) => (
                      <div
                        key={r.place.id}
                        className="border-border/40 flex items-baseline gap-2 border-b py-1.5 last:border-0"
                      >
                        <span className="text-muted-foreground w-4 shrink-0 font-mono text-[11px] tabular-nums">
                          {k + 1}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[12.5px] font-medium"
                          title={r.place.name}
                        >
                          {r.place.name}
                        </span>
                        <span className="font-mono text-[13px] font-semibold tabular-nums">
                          {r.slowTotal.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-1.5 font-mono text-[9.5px] leading-relaxed">
                    {res.kept
                      .map(
                        (r, k) =>
                          `${k + 1}· LM ${r.lm} RM ${r.rm} WWW ${(r.what * r.where * r.when).toFixed(2)}${r.hoursUnknown ? "?" : ""} P ${r.promos}${r.km != null ? ` ${Math.round(r.km)}km` : ""}`,
                      )
                      .join("   ")}
                  </p>
                  {res.screened > 0 ? (
                    <p className="text-muted-foreground mt-1 text-[10px]">
                      Fast screened out {res.screened} below the top {retrieval.shortlistN}.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
