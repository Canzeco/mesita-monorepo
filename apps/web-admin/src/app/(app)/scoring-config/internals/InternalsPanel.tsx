"use client";

import { useMemo, useState } from "react";
import {
  BadgePercent,
  Compass,
  Gavel,
  Layers,
  MapPin,
  Quote,
  ScanSearch,
  UserRound,
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
} from "@/lib/business/scores";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  cosineSim,
  embedText,
  generateIntent,
  haversineKm,
  smScoreParts,
  openWindow,
  fmFromVectors,
  whatFits,
  whatWindow,
  type ConsumerProfile,
  type Intent,
} from "@/lib/business/cip";
import { STRATEGIES, strategyForPlace, type StrategyId } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { LANE_SHORT, PanelCard } from "../panel-ui";
import {
  ConnectorPill,
  DocPre,
  EmptyCatalog,
  ENGINE_ICONS,
  FactChip,
  FactorRow,
  JudgeRow,
  RateCell,
  ResultLine,
  ScoreBox,
  SpecimenCell,
  VectorStrip,
} from "../playground-ui";

// SCORE INTERNALS — n = 1. One consumer × one intent × one place; each
// Sub-Score is its own box showing its whole internal process, result
// headlined. Everything recomputes live from the Pipeline tab's knobs +
// context config (shared provider). Generate is deterministic (seed counter).

type Specimen = { profile: ConsumerProfile; intent: Intent };

export function InternalsPanel() {
  const { consumers, places, cfg, bpVals, context, fmParams, smParams } = useScoring();
  const [flavor, setFlavor] = useState<EngineId>("swipe");
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<Specimen | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);

  const fmSet = useMemo(() => new Set(context.fm), [context.fm]);
  const smSet = useMemo(() => new Set(context.sm), [context.sm]);

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

    // FM — documents → vectors → cosine, at the configured dimensionality.
    const ragCiDoc = buildCiDoc(profile, intent, fmSet);
    const ragPlaceDoc = buildPlaceDoc(place, fmSet);
    const ciVec = embedText(ragCiDoc, fmParams.embedDims);
    const placeVec = embedText(ragPlaceDoc, fmParams.embedDims);
    const cos = cosineSim(ciVec, placeVec);
    const fm = fmFromVectors(ciVec, placeVec);

    // SM — the judge's documents + itemized adjustments, at the configured
    // rubric weights.
    const judgeCiDoc = buildCiDoc(profile, intent, smSet);
    const judgePlaceDoc = buildPlaceDoc(place, smSet);
    const ci = [
      ...(smSet.has("consumer.taste") ? profile.tasteTokens : []),
      ...(smSet.has("intent.query") ? intent.tokens : []),
    ];
    const sm = smScoreParts(ci, place, cid, fm, smSet, smParams);

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

    // BP — rates → posture → rung.
    const posture = strategyForPlace({
      welcome_free_rate: place.welcome_free_rate,
      welcome_premium_rate: place.welcome_premium_rate,
      free_rate: place.free_rate,
      premium_rate: place.premium_rate,
    }) as StrategyId;
    const bp = bpVals[posture] ?? 0;

    const laneRow = (lane: Lane) => ({
      lane,
      fast: laneScore(lane, { match: fm, what, where, when, bp }),
      slow: laneScore(lane, { match: sm.total, what, where, when, bp }),
    });

    return {
      cid, ragCiDoc, ragPlaceDoc, judgeCiDoc, judgePlaceDoc, ciVec, placeVec,
      cos, fm, sm, fits, what, km, where, win, wait, fit, when, posture, bp,
      lanes: LANES.map(laneRow),
    };
  }, [run, place, cfg, bpVals, fmSet, smSet, fmParams, smParams]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Score internals"
        subtitle="The whole internal process of every score, on exactly ONE consumer × intent × place."
      />
    );
  }

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
                {consumers.length === 0
                  ? "no consumers in DB — synthetic, labeled"
                  : `Generate draws from ${consumers.length} real consumer${consumers.length === 1 ? "" : "s"}`}
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
          {/* FM — docs → vectors → cosine */}
          <ScoreBox
            icon={ScanSearch}
            tint="emerald"
            title="FM Sub-Score · Fast-Match"
            note="documents → vectors → cosine"
            result={String(it.fm)}
          >
            <DocPre label="CI doc · FM context" text={it.ragCiDoc} empty="(every FM field toggled off)" />
            <VectorStrip vec={it.ciVec} className="mt-1.5" />
            <div className="my-1.5">
              <ConnectorPill>cos = {it.cos.toFixed(3)}</ConnectorPill>
            </div>
            <VectorStrip vec={it.placeVec} />
            <DocPre
              label={`place doc · ${place.name}`}
              text={it.ragPlaceDoc}
              empty="(every FM field toggled off)"
              className="mt-1.5"
            />
            <ResultLine>
              cos({fmParams.embedDims}d) {it.cos.toFixed(3)} → ×{MATCH_MAX}, floor 0 →{" "}
              <b>FM {it.fm}</b>
            </ResultLine>
          </ScoreBox>

          {/* SM — the judge itemized */}
          <ScoreBox
            icon={Gavel}
            tint="violet"
            title="SM Sub-Score · Slow-Match"
            note="the judge's copy + itemized verdict"
            result={String(it.sm.total)}
          >
            <DocPre label="CI doc · SM context" text={it.judgeCiDoc} empty="(every SM field toggled off)" />
            <DocPre
              label="place doc · SM context"
              text={it.judgePlaceDoc}
              empty="(every SM field toggled off)"
              className="mt-2"
            />
            <div className="border-border/50 mt-2.5 overflow-hidden rounded-lg border">
              <JudgeRow label="base — FM (vector cosine)" value={it.sm.base} />
              <JudgeRow
                label={`category in taste/intent (+${smParams.catBonus})`}
                value={it.sm.catBonus}
                dim={it.sm.catBonus === 0}
              />
              <JudgeRow
                label={`zone in taste/intent (+${smParams.zoneBonus})`}
                value={it.sm.zoneBonus}
                dim={it.sm.zoneBonus === 0}
              />
              <JudgeRow
                label={`occasion × category clash (−${smParams.clashPenalty})`}
                value={it.sm.clashPenalty}
                dim={it.sm.clashPenalty === 0}
              />
              <JudgeRow
                label={`judgment nuance (±${smParams.nuanceAmp}, pair-stable)`}
                value={it.sm.nuance}
              />
              <JudgeRow label="clamped 0–100" value={it.sm.total} strong />
            </div>
            <ResultLine>
              <b>SM {it.sm.total}</b> — vs FM {it.fm}: the gap is what the judge changed
            </ResultLine>
          </ScoreBox>

          {/* WWW — the only numbers */}
          <ScoreBox
            icon={Compass}
            tint="amber"
            title="WWW Sub-Score · the moment"
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

          {/* BP — rates → posture → rung */}
          <ScoreBox
            icon={BadgePercent}
            tint="rose"
            title="BP Sub-Score · Business Promo"
            note="live rates → posture → rung"
            result={String(it.bp)}
          >
            <div className="grid grid-cols-4 gap-1.5">
              <RateCell label="welcome · free" value={place.welcome_free_rate} />
              <RateCell label="welcome · prem" value={place.welcome_premium_rate} />
              <RateCell label="returning · free" value={place.free_rate} />
              <RateCell label="returning · prem" value={place.premium_rate} />
            </div>
            <div className="mt-2.5">
              <ConnectorPill>
                posture: {STRATEGIES.find((s) => s.id === it.posture)?.name ?? it.posture}
              </ConnectorPill>
            </div>
            <ResultLine>
              rung <b>BP {it.bp}</b>
              {it.bp === 0 ? " — not in the paid lane (nothing to promote)" : ""}
            </ResultLine>
          </ScoreBox>

          {/* Scores — the four Lanes × two tiers */}
          <ScoreBox
            icon={Layers}
            tint="sky"
            title="Scores · four Lanes × two tiers"
            note="each Lane's Score, from the Sub-Scores above"
            className="xl:col-span-2"
          >
            <div className="border-border/50 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-border/50 border-b">
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Lane</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Formula</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">Fast (FM {it.fm})</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">Slow (SM {it.sm.total})</th>
                  </tr>
                </thead>
                <tbody>
                  {it.lanes.map(({ lane, fast, slow }) => (
                    <tr key={lane.id} className="border-border/40 border-b last:border-0">
                      <td className="px-2.5 py-1.5 font-mono text-[10.5px] font-semibold">{LANE_SHORT[lane.id]}</td>
                      <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[10px]">
                        {laneFormula(lane, "FM")} | {laneFormula(lane, "SM")}
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
