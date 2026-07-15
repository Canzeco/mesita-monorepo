"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  embedText,
  generateIntent,
  haversineKm,
  lmCip,
  openWindow,
  rmFromVectors,
  whatFits,
  type ConsumerProfile,
  type Intent,
  type SamplePlace,
} from "@/lib/business/cip";
import { strategyForPlace, type StrategyId } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { PanelCard } from "../panel-ui";
import { EmptyCatalog, ENGINE_ICONS, FactChip, ScoreCell } from "../playground-ui";

// ENGINES — the three engines ranking the WHOLE sample. Inputs in, ranked
// lists out; any score's internal process lives on the Internals subpage.
// Everything recomputes live from the Pipeline tab's knobs + context config
// (shared provider). Generate is deterministic (seed counter).

type EngineRun = { profile: ConsumerProfile; intent: Intent };

type ScoredRow = {
  place: SamplePlace;
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

type EngineResult = { kept: ScoredRow[]; screened: number };

export function EnginesPanel() {
  const router = useRouter();
  const { consumers, places, cfg, mix, retrieval, promoVals, context, ripmParams, lipmParams } =
    useScoring();

  const [runs, setRuns] = useState<Partial<Record<EngineId, EngineRun>>>({});
  const [seed, setSeed] = useState(1);

  const generate = (engine: EngineId) => {
    const s = seed;
    setSeed((x) => x + 1);
    const offset = ENGINE_POLICIES.findIndex((e) => e.id === engine);
    const consumer = consumers.length > 0 ? consumers[(s * 7 + offset) % consumers.length] : null;
    const profile = buildConsumerProfile(consumer);
    const intent = generateIntent(engine, profile, places, s * 13 + offset * 5);
    setRuns((r) => ({ ...r, [engine]: { profile, intent } }));
  };

  const ripmSet = useMemo(() => new Set(context.ripm), [context.ripm]);
  const lipmSet = useMemo(() => new Set(context.lipm), [context.lipm]);

  // Place vectors are intent-independent — embed once per sample per config.
  const placeIndex = useMemo(
    () => new Map(places.map((p) => [p.id, embedText(buildPlaceDoc(p, ripmSet), ripmParams.embedDims)])),
    [places, ripmSet, ripmParams.embedDims],
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
      const ci = [
        ...(lipmSet.has("consumer.taste") ? run.profile.tasteTokens : []),
        ...(lipmSet.has("intent.query") ? run.intent.tokens : []),
      ];
      const cid = run.profile.consumer?.id ?? "synthetic";
      const ciVec = embedText(buildCiDoc(run.profile, run.intent, ripmSet), ripmParams.embedDims);

      const rows: ScoredRow[] = places.map((p) => {
        const pVec =
          placeIndex.get(p.id) ?? embedText(buildPlaceDoc(p, ripmSet), ripmParams.embedDims);
        const rm = rmFromVectors(ciVec, pVec);
        const lm = lmCip(ci, p, cid, rm, lipmSet, lipmParams);
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
          place: p, rm, lm, what, where, when, www: what * where * when, km,
          hoursUnknown: win.unknown, promos,
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
  }, [runs, places, placeIndex, cfg, mix, promoVals, retrieval, ripmSet, lipmSet, ripmParams, lipmParams]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Engines"
        subtitle="The three engines ranking the whole sample — inputs in, ranked lists out."
      />
    );
  }

  return (
    <PanelCard
      title="Engines"
      subtitle={`The three engines ranking the WHOLE sample (${places.length} places) — inputs in, ranked lists out. For any score's internal process, use the Internals tab. Fast screens top ${retrieval.shortlistN} → Slow sorts.`}
      pill={`n = ${places.length}`}
    >
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px] leading-snug">
          {consumers.length === 0
            ? "No consumers in the DB — runs use a labeled synthetic consumer."
            : "Generate picks a consumer, synthesizes an intent, scores every place, ranks."}
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
          const Icon = ENGINE_ICONS[e.id];
          const maxSlow = res ? Math.max(1, ...res.kept.map((r) => r.slowTotal)) : 1;
          return (
            <div key={e.id} className="border-border/60 overflow-hidden rounded-2xl border">
              <div className="bg-muted/50 border-border/60 flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="bg-pink-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] leading-tight font-semibold">{e.engine}</p>
                    <p className="text-muted-foreground truncate font-mono text-[9.5px]">
                      {e.id === "memo" ? "flexible intent · " : "fixed prompt · "}
                      {e.policy}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => generate(e.id)}
                  className="bg-pink-gradient shadow-save shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
                >
                  Generate
                </button>
              </div>

              <div className="p-3.5">
                {!run || !res ? (
                  <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed px-3 py-5 text-center text-[11.5px]">
                    Generate to run: consumer → intent → scores → ranking.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {/* the query side */}
                    <div className="bg-muted/40 border-border/50 rounded-xl border px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FactChip value={run.profile.consumer?.label ?? "synthetic"} strong />
                        {run.profile.consumer?.sex ? <FactChip value={run.profile.consumer.sex} /> : null}
                        {run.profile.consumer?.age != null ? <FactChip value={`${run.profile.consumer.age}y`} /> : null}
                        {run.profile.consumer?.country ? <FactChip value={run.profile.consumer.country} /> : null}
                        <FactChip value={`${run.profile.consumer?.class_key ?? "free"} class`} />
                        {run.profile.synthetic ? <FactChip value="taste SYNTH" warn /> : null}
                      </div>
                      <p className="mt-2 text-[11.5px] leading-snug font-medium">“{run.intent.parts.query}”</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <FactChip label="when" value={run.intent.timeLabel} />
                        {run.intent.parts.zone ? <FactChip label="where" value={run.intent.parts.zone} /> : null}
                        {run.intent.parts.party ? <FactChip value={run.intent.parts.party} /> : null}
                      </div>
                    </div>

                    {/* the ranking */}
                    <div className="flex flex-col gap-1.5">
                      {res.kept.map((r, k) => (
                        <div
                          key={r.place.id}
                          className={
                            "rounded-xl border px-2.5 py-2 " +
                            (k === 0
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/60 bg-card")
                          }
                        >
                          <div className="flex items-baseline gap-2">
                            <span
                              className={
                                "flex h-4.5 w-4.5 shrink-0 translate-y-0.5 items-center justify-center rounded-full font-mono text-[9.5px] font-bold " +
                                (k === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
                              }
                              aria-hidden
                            >
                              {k + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" title={r.place.name}>
                              {r.place.name}
                            </span>
                            <span
                              className="font-display text-[15px] font-semibold tabular-nums"
                              title={`fast ${r.fastTotal.toFixed(1)} → slow ${r.slowTotal.toFixed(1)} (ranked by slow)`}
                            >
                              {r.slowTotal.toFixed(1)}
                            </span>
                          </div>
                          <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full" aria-hidden>
                            <div
                              className="bg-pink-gradient h-full rounded-full"
                              style={{ width: `${Math.max(2, (r.slowTotal / maxSlow) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1.5 grid grid-cols-4 gap-1">
                            <ScoreCell label="RM" value={String(r.rm)} hint="RAG match — cosine(CI, place) × 100" />
                            <ScoreCell label="LM" value={String(r.lm)} hint="LLM match — RM + judge adjustments" />
                            <ScoreCell
                              label="WWW"
                              value={r.www.toFixed(2)}
                              hint={`what ${r.what.toFixed(2)} × where ${r.where.toFixed(2)} × when ${r.when.toFixed(2)}${r.hoursUnknown ? " (hours?)" : ""}${r.km != null ? ` · ${Math.round(r.km)} km` : ""}`}
                            />
                            <ScoreCell label="P" value={String(r.promos)} hint="promo posture from live rates" />
                          </div>
                        </div>
                      ))}
                    </div>
                    {res.screened > 0 ? (
                      <p className="text-muted-foreground text-[10px]">
                        Fast screened out {res.screened} below the top {retrieval.shortlistN}.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
