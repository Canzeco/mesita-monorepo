"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgePercent,
  Compass,
  GalleryHorizontalEnd,
  Gavel,
  Layers,
  Map as MapIcon,
  MapPin,
  MessagesSquare,
  Quote,
  ScanSearch,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  ENGINE_POLICIES,
  fitScore,
  laneFormula,
  laneScore,
  LANES,
  MATCH_MAX,
  waitScore,
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
  lmCipParts,
  openWindow,
  rmFromVectors,
  SAMPLE_MAX,
  whatFits,
  whatWindow,
  type ConsumerProfile,
  type Intent,
  type SamplePlace,
} from "@/lib/business/cip";
import { STRATEGIES, strategyForPlace, type StrategyId } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { LANE_SHORT, PanelCard } from "../panel-ui";

// TWO PLAYGROUNDS, divided by question:
//
//   Score internals  ONE consumer × ONE intent × ONE place (n = 1). Each
//                    sub-score gets its own box showing its whole internal
//                    process, with the RESULT headlined in the box header.
//   Engines          the three engines ranking the WHOLE sample — inputs in,
//                    ranked lists out.
//
// Everything recomputes live from the Pipeline tab's knobs + context config
// (shared provider). Generate is deterministic (seed counter — reproducible,
// no Math.random in render scope).

const ENGINE_ICONS: Record<EngineId, LucideIcon> = {
  swipe: GalleryHorizontalEnd,
  map: MapIcon,
  memo: MessagesSquare,
};

export function PlaygroundPanel() {
  const { consumers, places } = useScoring();

  if (places.length === 0) {
    return (
      <PanelCard
        title="Playground"
        subtitle="Real consumer + synthetic intent + real place → scores per engine."
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
    <div className="flex flex-col gap-4 sm:gap-5">
      <InternalsPlayground consumers={consumers.length} />
      <EnginesPlayground />
    </div>
  );
}

// ══ Playground 1 — SCORE INTERNALS, n = 1 ════════════════════════════════

type Specimen = { profile: ConsumerProfile; intent: Intent };

function InternalsPlayground({ consumers: consumerCount }: { consumers: number }) {
  const { consumers, places, cfg, promoVals, context } = useScoring();
  const [flavor, setFlavor] = useState<EngineId>("swipe");
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<Specimen | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);

  const ripmSet = useMemo(() => new Set(context.ripm), [context.ripm]);
  const lipmSet = useMemo(() => new Set(context.lipm), [context.lipm]);

  const place = places.find((p) => p.id === placeId) ?? places[0];

  const generate = (f: EngineId) => {
    const s = seed;
    setSeed((x) => x + 1);
    const consumer = consumers.length > 0 ? consumers[(s * 7) % consumers.length] : null;
    const profile = buildConsumerProfile(consumer);
    setRun({ profile, intent: generateIntent(f, profile, places, s * 13) });
  };
  const pickFlavor = (f: EngineId) => {
    setFlavor(f);
    if (run) generate(f);
  };

  const it = useMemo(() => {
    if (!run || !place) return null;
    const { profile, intent } = run;
    const cid = profile.consumer?.id ?? "synthetic";

    // RM — documents → vectors → cosine.
    const ragCiDoc = buildCiDoc(profile, intent, ripmSet);
    const ragPlaceDoc = buildPlaceDoc(place, ripmSet);
    const ciVec = embedText(ragCiDoc);
    const placeVec = embedText(ragPlaceDoc);
    const cos = cosineSim(ciVec, placeVec);
    const rm = rmFromVectors(ciVec, placeVec);

    // LM — the judge's documents + itemized adjustments on top of RM.
    const judgeCiDoc = buildCiDoc(profile, intent, lipmSet);
    const judgePlaceDoc = buildPlaceDoc(place, lipmSet);
    const ci = [
      ...(lipmSet.has("consumer.taste") ? profile.tasteTokens : []),
      ...(lipmSet.has("intent.query") ? intent.tokens : []),
    ];
    const lm = lmCipParts(ci, place, cid, rm, lipmSet);

    // WWW — the only numbers.
    const fits = whatFits(place.category, intent.hour);
    const what = whatScore(fits, cfg);
    const km =
      intent.lat != null && intent.lng != null && place.lat != null && place.lng != null
        ? haversineKm(intent.lat, intent.lng, Number(place.lat), Number(place.lng))
        : null;
    const where = whereScore(km, cfg);
    const win = openWindow(place.hours, intent.day, intent.hour);
    const wait = win.unknown ? 1 : waitScore(win.opensInH, cfg);
    const fit = win.unknown ? 1 : fitScore(win.openForH, cfg);
    const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);

    // P — rates → posture → rung.
    const posture = strategyForPlace({
      welcome_free_rate: place.welcome_free_rate,
      welcome_premium_rate: place.welcome_premium_rate,
      free_rate: place.free_rate,
      premium_rate: place.premium_rate,
    }) as StrategyId;
    const promos = promoVals[posture] ?? 0;

    const laneRow = (lane: Lane) => ({
      lane,
      fast: laneScore(lane, { match: rm, what, where, when, promos }),
      slow: laneScore(lane, { match: lm.total, what, where, when, promos }),
    });

    return {
      cid, ragCiDoc, ragPlaceDoc, judgeCiDoc, judgePlaceDoc, ciVec, placeVec,
      cos, rm, lm, fits, what, km, where, win, wait, fit, when, posture, promos,
      lanes: LANES.map(laneRow),
    };
  }, [run, place, cfg, promoVals, ripmSet, lipmSet]);

  const c = run?.profile.consumer ?? null;

  return (
    <PanelCard
      title="Score internals"
      subtitle="The whole internal process of every score, on exactly ONE consumer × intent × place. Each score is its own box; the specimen lives below."
      pill="n = 1"
    >
      {/* ── The specimen: C × I × P ─────────────────────────────────── */}
      <div className="border-border/60 from-muted/60 to-card mt-4 rounded-2xl border bg-gradient-to-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="border-border/70 bg-card flex overflow-hidden rounded-full border">
            {ENGINE_POLICIES.map((e) => {
              const Icon = ENGINE_ICONS[e.id];
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={flavor === e.id}
                  onClick={() => pickFlavor(e.id)}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold transition " +
                    (flavor === e.id ? "bg-foreground text-background" : "hover:bg-muted")
                  }
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {e.engine}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => generate(flavor)}
            className="bg-pink-gradient shadow-save rounded-full px-4 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
          >
            Generate consumer + intent
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <SpecimenCell icon={UserRound} tone="text-sky-700 bg-sky-100" label="Consumer">
            {run ? (
              <div className="flex flex-wrap gap-1.5">
                <FactChip value={c?.label ?? "synthetic"} strong />
                {c?.sex ? <FactChip value={c.sex} /> : null}
                {c?.age != null ? <FactChip value={`${c.age}y`} /> : null}
                {c?.country ? <FactChip value={c.country} /> : null}
                <FactChip value={`${c?.class_key ?? "free"} class`} />
                {run.profile.synthetic ? <FactChip value="taste SYNTH" warn /> : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-[10.5px]">
                {consumerCount === 0
                  ? "no consumers in DB — synthetic, labeled"
                  : `Generate draws from ${consumerCount} real consumer${consumerCount === 1 ? "" : "s"}`}
              </p>
            )}
          </SpecimenCell>

          <SpecimenCell icon={Quote} tone="text-violet-700 bg-violet-100" label="Intent">
            {run ? (
              <>
                <p className="text-[11.5px] leading-snug font-medium">“{run.intent.parts.query}”</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <FactChip label="when" value={run.intent.timeLabel} />
                  {run.intent.parts.zone ? <FactChip label="where" value={run.intent.parts.zone} /> : null}
                  {run.intent.parts.party ? <FactChip value={run.intent.parts.party} /> : null}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-[10.5px]">
                synthesized per engine flavor — Memo flexible, Swipe/Map fixed structure
              </p>
            )}
          </SpecimenCell>

          <SpecimenCell icon={MapPin} tone="text-rose-700 bg-rose-100" label="Place">
            <div className="flex flex-wrap gap-1.5">
              {places.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === place.id}
                  onClick={() => setPlaceId(p.id)}
                  className={
                    "max-w-[170px] truncate rounded-md border px-2 py-0.5 font-mono text-[10.5px] transition " +
                    (p.id === place.id
                      ? "border-primary/50 bg-primary/10 font-semibold"
                      : "border-border/60 text-muted-foreground hover:bg-muted bg-card")
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </SpecimenCell>
        </div>
      </div>

      {!run || !it ? (
        <div className="border-border/60 text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-[12px]">
          Generate a consumer + intent — every box below walks one score&apos;s internals for that
          single pair.
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 xl:grid-cols-2">
          {/* RM — docs → vectors → cosine */}
          <ScoreBox
            icon={ScanSearch}
            tint="emerald"
            title="RM-CIP · RAG match"
            note="documents → vectors → cosine"
            result={String(it.rm)}
          >
            <DocPre label="CI doc · RIPM context" text={it.ragCiDoc} empty="(every RIPM field toggled off)" />
            <VectorStrip vec={it.ciVec} className="mt-1.5" />
            <div className="my-1.5 flex items-center gap-2">
              <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
              <span className="border-border/70 bg-muted rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold">
                cos = {it.cos.toFixed(3)}
              </span>
              <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
            </div>
            <VectorStrip vec={it.placeVec} />
            <DocPre
              label={`place doc · ${place.name}`}
              text={it.ragPlaceDoc}
              empty="(every RIPM field toggled off)"
              className="mt-1.5"
            />
            <ResultLine>
              cos({EMBED_DIMS}d) {it.cos.toFixed(3)} → ×{MATCH_MAX}, floor 0 → <b>RM {it.rm}</b>
            </ResultLine>
          </ScoreBox>

          {/* LM — the judge itemized */}
          <ScoreBox
            icon={Gavel}
            tint="violet"
            title="LM-CIP · LLM match"
            note="the judge's copy + itemized verdict"
            result={String(it.lm.total)}
          >
            <DocPre label="CI doc · LIPM context" text={it.judgeCiDoc} empty="(every LIPM field toggled off)" />
            <DocPre
              label="place doc · LIPM context"
              text={it.judgePlaceDoc}
              empty="(every LIPM field toggled off)"
              className="mt-2"
            />
            <div className="border-border/50 mt-2.5 overflow-hidden rounded-lg border">
              <JudgeRow label="base — RM (vector cosine)" value={it.lm.base} />
              <JudgeRow label="category in taste/intent (+15)" value={it.lm.catBonus} dim={it.lm.catBonus === 0} />
              <JudgeRow label="zone in taste/intent (+8)" value={it.lm.zoneBonus} dim={it.lm.zoneBonus === 0} />
              <JudgeRow label="occasion × category clash (−18)" value={it.lm.clashPenalty} dim={it.lm.clashPenalty === 0} />
              <JudgeRow label="judgment nuance (±6, pair-stable)" value={it.lm.nuance} />
              <JudgeRow label="clamped 0–100" value={it.lm.total} strong />
            </div>
            <ResultLine>
              <b>LM {it.lm.total}</b> — vs RM {it.rm}: the gap is what the judge changed
            </ResultLine>
          </ScoreBox>

          {/* WWW — the only numbers */}
          <ScoreBox
            icon={Compass}
            tint="amber"
            title="WWW · the moment"
            note="what × where × when — the only numbers"
            result={(it.what * it.where * it.when).toFixed(2)}
          >
            <FactorRow
              name="WHAT"
              inputs={`${place.category ?? "unknown category"} at ${run.intent.timeLabel}${whatWindow(place.category) ? ` · window ${whatWindow(place.category)}` : " · no daypart window"}`}
              math={it.fits ? "in daypart → 1.00" : `off daypart → ×${cfg.whatOffFactor.toFixed(2)}`}
              value={it.what}
            />
            <FactorRow
              name="WHERE"
              inputs={it.km != null ? `${it.km.toFixed(1)} km (haversine, intent → place)` : "no geo on one side"}
              math={it.km != null ? `1/(1+(${it.km.toFixed(1)}/${cfg.distanceHalfKm})^${cfg.distanceExp})` : "unknown → neutral 1.00"}
              value={it.where}
            />
            <FactorRow
              name="WHEN"
              inputs={
                it.win.unknown
                  ? "no hours data (unknown ≠ closed)"
                  : `opens in ${it.win.opensInH.toFixed(1)} h · open for ${it.win.openForH.toFixed(1)} h`
              }
              math={
                it.win.unknown
                  ? "unknown → neutral 1.00"
                  : `wait ${it.wait.toFixed(2)} × fit ${it.fit.toFixed(2)}`
              }
              value={it.when}
            />
            <ResultLine>
              {it.what.toFixed(2)} × {it.where.toFixed(2)} × {it.when.toFixed(2)} ={" "}
              <b>WWW {(it.what * it.where * it.when).toFixed(2)}</b> — multiplies the match in
              now-mode, never feeds it
            </ResultLine>
          </ScoreBox>

          {/* P — rates → posture → rung */}
          <ScoreBox
            icon={BadgePercent}
            tint="rose"
            title="P · promo score"
            note="live rates → posture → rung"
            result={String(it.promos)}
          >
            <div className="grid grid-cols-4 gap-1.5">
              <RateCell label="welcome · free" value={place.welcome_free_rate} />
              <RateCell label="welcome · prem" value={place.welcome_premium_rate} />
              <RateCell label="returning · free" value={place.free_rate} />
              <RateCell label="returning · prem" value={place.premium_rate} />
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
              <span className="border-border/70 bg-muted rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold">
                posture: {STRATEGIES.find((s) => s.id === it.posture)?.name ?? it.posture}
              </span>
              <span className="border-border/60 flex-1 border-t border-dashed" aria-hidden />
            </div>
            <ResultLine>
              rung <b>P {it.promos}</b>
              {it.promos === 0 ? " — not in the paid lane (nothing to promote)" : ""}
            </ResultLine>
          </ScoreBox>

          {/* Lane assembly */}
          <ScoreBox
            icon={Layers}
            tint="sky"
            title="Lane assembly"
            note="the four lanes × two tiers, from the values above"
            className="xl:col-span-2"
          >
            <div className="border-border/50 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-border/50 border-b">
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Lane</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Formula</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">Fast (RM {it.rm})</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">Slow (LM {it.lm.total})</th>
                  </tr>
                </thead>
                <tbody>
                  {it.lanes.map(({ lane, fast, slow }) => (
                    <tr key={lane.id} className="border-border/40 border-b last:border-0">
                      <td className="px-2.5 py-1.5 font-mono text-[10.5px] font-semibold">{LANE_SHORT[lane.id]}</td>
                      <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[10px]">
                        {laneFormula(lane, "RIPM")} | {laneFormula(lane, "LIPM")}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[11px] tabular-nums">{fast.toFixed(1)}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[11px] font-semibold tabular-nums">{slow.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScoreBox>
        </div>
      )}
    </PanelCard>
  );
}

// ══ Playground 2 — ENGINES over the whole sample ═════════════════════════

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

function EnginesPlayground() {
  const router = useRouter();
  const { consumers, places, cfg, mix, retrieval, promoVals, context } = useScoring();

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
    () => new Map(places.map((p) => [p.id, embedText(buildPlaceDoc(p, ripmSet))])),
    [places, ripmSet],
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
      const ciVec = embedText(buildCiDoc(run.profile, run.intent, ripmSet));

      const rows: ScoredRow[] = places.map((p) => {
        const pVec = placeIndex.get(p.id) ?? embedText(buildPlaceDoc(p, ripmSet));
        const rm = rmFromVectors(ciVec, pVec);
        const lm = lmCip(ci, p, cid, rm, lipmSet);
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
  }, [runs, places, placeIndex, cfg, mix, promoVals, retrieval, ripmSet, lipmSet]);

  return (
    <PanelCard
      title="Engines"
      subtitle={`The three engines ranking the WHOLE sample (${places.length} places) — inputs in, ranked lists out. For any score's internal process, use Score internals above. Fast screens top ${retrieval.shortlistN} → Slow sorts.`}
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

// ── Local bits ─────────────────────────────────────────────────────────

/** One cell of the specimen bar — tinted icon circle + label + content. */
function SpecimenCell({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-card rounded-xl border px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon className="h-3 w-3" aria-hidden />
        </span>
        <span className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
          {label}
        </span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// One score, one box: tinted icon circle + title in the header, the RESULT
// headlined top-right, the process in the body.
const SCORE_TINTS = {
  sky: { box: "border-sky-200/70", head: "bg-sky-50 text-sky-950", circle: "bg-sky-600" },
  violet: { box: "border-violet-200/70", head: "bg-violet-50 text-violet-950", circle: "bg-violet-600" },
  emerald: { box: "border-emerald-200/70", head: "bg-emerald-50 text-emerald-950", circle: "bg-emerald-600" },
  amber: { box: "border-amber-200/70", head: "bg-amber-50 text-amber-950", circle: "bg-amber-600" },
  rose: { box: "border-rose-200/70", head: "bg-rose-50 text-rose-950", circle: "bg-rose-600" },
} as const;

function ScoreBox({
  icon: Icon,
  tint,
  title,
  note,
  result,
  className = "",
  children,
}: {
  icon: LucideIcon;
  tint: keyof typeof SCORE_TINTS;
  title: string;
  note: string;
  result?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = SCORE_TINTS[tint];
  return (
    <section className={`overflow-hidden rounded-2xl border ${t.box} ${className}`}>
      <div className={`flex items-center gap-2.5 px-3.5 py-2 ${t.head}`}>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${t.circle}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-tight font-bold tracking-tight">{title}</p>
          <p className="truncate font-mono text-[9px] leading-tight opacity-70">{note}</p>
        </div>
        {result != null ? (
          <span className="font-display shrink-0 text-lg font-semibold tabular-nums">{result}</span>
        ) : null}
      </div>
      <div className="bg-card px-3.5 py-3">{children}</div>
    </section>
  );
}

/** A small labeled fact (consumer trait, intent slot). */
function FactChip({
  label,
  value,
  warn,
  strong,
}: {
  label?: string;
  value: string;
  warn?: boolean;
  strong?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 " +
        (warn ? "border-amber-300/80 bg-amber-50 text-amber-900" : "border-border/60 bg-muted/50")
      }
    >
      {label ? <span className="text-muted-foreground font-mono text-[8.5px] font-bold uppercase">{label}</span> : null}
      <span className={"font-mono text-[10.5px]" + (strong ? " font-semibold" : "")}>{value}</span>
    </span>
  );
}

/** One sub-score, its own labeled cell — RM · LM · WWW · P read as four boxes. */
function ScoreCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div title={hint} className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
      <p className="text-muted-foreground font-mono text-[8.5px] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** A verbatim context document, labeled. */
function DocPre({
  label,
  text,
  empty,
  className = "",
}: {
  label: string;
  text: string;
  empty: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground font-mono text-[9px] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <pre className="bg-muted/40 border-border/50 mt-1 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] leading-relaxed whitespace-pre-wrap">
        {text || empty}
      </pre>
    </div>
  );
}

/** One line of the judge's itemized verdict. */
function JudgeRow({
  label,
  value,
  dim,
  strong,
}: {
  label: string;
  value: number;
  dim?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={
        "border-border/40 flex items-baseline justify-between gap-3 border-b px-2.5 py-1 last:border-0 " +
        (strong ? "bg-muted/50" : "") +
        (dim ? " opacity-50" : "")
      }
    >
      <span className={"text-[10.5px] " + (strong ? "font-semibold" : "")}>{label}</span>
      <span className={"font-mono text-[11px] tabular-nums " + (strong ? "font-bold" : "")}>
        {!strong && value > 0 ? `+${value}` : value}
      </span>
    </div>
  );
}

/** The box's bottom line — inputs already shown, this is the arithmetic. */
function ResultLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border/50 mt-2.5 border-t pt-2 font-mono text-[10.5px] leading-relaxed">
      {children}
    </p>
  );
}

/** One WWW factor: its inputs, its math, its value. */
function FactorRow({
  name,
  inputs,
  math,
  value,
}: {
  name: string;
  inputs: string;
  math: string;
  value: number;
}) {
  return (
    <div className="border-border/40 flex items-center gap-2.5 border-b py-1.5 first:pt-0 last:border-0">
      <span className="text-muted-foreground w-11 shrink-0 font-mono text-[9px] font-bold tracking-[0.08em] uppercase">
        {name}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10.5px]" title={inputs}>{inputs}</span>
        <span className="text-muted-foreground block truncate font-mono text-[9.5px]" title={math}>{math}</span>
      </span>
      <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

/** One promo rate, labeled. */
function RateCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
      <p className="text-muted-foreground font-mono text-[8px] font-bold tracking-[0.04em] uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">
        {value != null ? `${value}%` : "—"}
      </p>
    </div>
  );
}

/** A generated vector as a mirrored waveform: bars up = positive slots,
 * bars down = negative, around a faint baseline. */
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
        "bg-muted/40 border-border/50 relative flex items-stretch gap-px overflow-hidden rounded-md border px-0.5 " +
        (mini ? "h-4" : "h-9") +
        " " +
        className
      }
      title={`${vec.length}d feature-hash embedding (emulated) — up = positive slot, down = negative`}
    >
      <span className="border-border/60 pointer-events-none absolute inset-x-0 top-1/2 border-t" aria-hidden />
      {vals.map((v, i) => {
        const h = Math.max(6, (Math.abs(v) / max) * 46);
        return (
          <span key={i} className="relative w-full" aria-hidden>
            <span
              className={
                "absolute right-0 left-0 " +
                (v >= 0 ? "bottom-1/2 rounded-t-[1px] bg-sky-500/70" : "top-1/2 rounded-b-[1px] bg-pink-500/70")
              }
              style={{ height: `${h}%` }}
            />
          </span>
        );
      })}
    </div>
  );
}
