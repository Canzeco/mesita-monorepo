"use client";

import { useMemo, useState } from "react";
import {
  BadgePercent,
  Compass,
  History,
  Layers,
  MapPin,
  Quote,
  ScanSearch,
  Star,
  UserRound,
} from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import {
  CH_ENGINES,
  chScore,
  ENGINE_POLICIES,
  fitScore,
  gpParts,
  laneFormula,
  laneScore,
  LANES,
  ES_MAX,
  waitScore,
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
  esFromVectors,
  generateIntent,
  haversineKm,
  openWindow,
  type ConsumerProfile,
  type Intent,
} from "@/lib/business/cip";
import { STRATEGIES, strategyForPlace } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { LANE_SHORT, PanelPill } from "../panel-ui";
import {
  ConnectorPill,
  DocPre,
  EmptyCatalog,
  ENGINE_ICONS,
  FactChip,
  FactorRow,
  LaneBadge,
  LedgerRow,
  RateCell,
  ResultLine,
  ScoreBox,
  SpecimenCell,
  VectorStrip,
} from "../playground-ui";

// CARDS — n = 1. One consumer × one intent × one place = ONE CARD; each
// Subscore is its own box showing its whole internal process, result
// headlined, and the Card's four Scores assemble at the bottom. Everything
// recomputes live from the Subscores tab's knobs + context config (shared
// provider). Generate is deterministic (seed counter).

type Specimen = { profile: ConsumerProfile; intent: Intent };

export function CardsPanel() {
  const { consumers, places, cfg, gpParams, rpVals, context, esParams } = useScoring();
  const [flavor, setFlavor] = useState<EngineId>("swipe");
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<Specimen | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);

  const esSet = useMemo(() => new Set(context.es), [context.es]);

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

    // ES — documents → vectors → cosine, at the configured dimensionality.
    const ciDoc = buildCiDoc(profile, intent, esSet);
    const placeDoc = buildPlaceDoc(place, esSet);
    const ciVec = embedText(ciDoc, esParams.embedDims);
    const placeVec = embedText(placeDoc, esParams.embedDims);
    const cos = cosineSim(ciVec, placeVec);
    const es = esFromVectors(ciVec, placeVec);

    // GP — google reviews → volume × quality → floor.
    const gp = gpParts(place.google_review_count, place.google_stars_overall, gpParams);

    // RP — rates → posture → rung.
    const posture = strategyForPlace({
      welcome_free_rate: place.welcome_free_rate,
      welcome_premium_rate: place.welcome_premium_rate,
      free_rate: place.free_rate,
      premium_rate: place.premium_rate,
    });
    const rp = (posture ? rpVals[posture] : rpVals.zero) ?? 0;

    // IC — where × when, the intent's numeric context.
    const km =
      intent.lat != null && intent.lng != null && place.lat != null && place.lng != null
        ? haversineKm(intent.lat, intent.lng, Number(place.lat), Number(place.lng))
        : null;
    const where = whereScore(km, cfg);
    const win = openWindow(place.hours, intent.day, intent.hour);
    const wait = win.unknown ? 1 : waitScore(win.opensInH, cfg);
    const fit = win.unknown ? 1 : fitScore(win.openForH, cfg);
    const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);
    const ic = where * when;

    // CH — Swipe-only pair history; stub 1 today, absent (≡1) elsewhere.
    const ch = CH_ENGINES.has(intent.engine) ? chScore() : undefined;

    const laneRow = (lane: Lane) => ({
      lane,
      score: laneScore(lane, { es, gp: gp.gp, rp, ic, ch }),
    });

    return {
      ciDoc, placeDoc, ciVec, placeVec, cos, es, gp, posture, rp,
      km, where, win, wait, fit, when, ic, ch,
      lanes: LANES.map(laneRow),
    };
  }, [run, place, cfg, gpParams, rpVals, esSet, esParams]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Cards"
        subtitle="A CARD = one consumer × intent × place, with its four Scores — every Subscore's internal process, on exactly one card."
      />
    );
  }

  const c = run?.profile.consumer ?? null;

  return (
    <SectionCard
      title="Cards"
      subtitle="A CARD = one consumer × intent × place, with its four Scores. Each Subscore is its own box showing its whole internal process; the Card assembles at the bottom. The specimen lives below."
      action={<PanelPill>n = 1</PanelPill>}
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
          Generate a consumer + intent — every box below walks one Subscore&apos;s internals for
          that single card.
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 xl:grid-cols-2">
          {/* ES — docs → vectors → cosine */}
          <ScoreBox
            icon={ScanSearch}
            tint="emerald"
            title="ES Subscore · Embeddings Similarity"
            note="documents → vectors → cosine"
            result={String(it.es)}
          >
            <DocPre label="CI doc · ES context" text={it.ciDoc} empty="(every ES field toggled off)" />
            <VectorStrip vec={it.ciVec} className="mt-1.5" />
            <div className="my-1.5">
              <ConnectorPill>cos = {it.cos.toFixed(3)}</ConnectorPill>
            </div>
            <VectorStrip vec={it.placeVec} />
            <DocPre
              label={`place doc · ${place.name}`}
              text={it.placeDoc}
              empty="(every ES field toggled off)"
              className="mt-1.5"
            />
            <ResultLine>
              cos({esParams.embedDims}d) {it.cos.toFixed(3)} → ×{ES_MAX}, floor 0 →{" "}
              <b>ES {it.es}</b>
            </ResultLine>
          </ScoreBox>

          {/* GP — reviews × rating → volume × quality → floor */}
          <ScoreBox
            icon={Star}
            tint="violet"
            title="GP Subscore · Google Popularity"
            note="reviews × rating → volume × quality → floor"
            result={it.gp.gp.toFixed(2)}
          >
            <div className="grid grid-cols-2 gap-1.5">
              <div className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
                <p className="text-muted-foreground font-mono text-[8px] font-bold tracking-[0.04em] uppercase">google rating</p>
                <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">
                  {it.gp.rating != null ? `${it.gp.rating}★` : "—"}
                </p>
              </div>
              <div className="border-border/50 bg-muted/50 rounded-md border px-1 py-1 text-center">
                <p className="text-muted-foreground font-mono text-[8px] font-bold tracking-[0.04em] uppercase">reviews</p>
                <p className="mt-0.5 font-mono text-[12px] font-semibold tabular-nums">
                  {it.gp.reviews.toLocaleString("en-US")}
                </p>
              </div>
            </div>
            <div className="mt-2.5">
              <FactorRow
                name="VOLUME"
                inputs={`${it.gp.reviews.toLocaleString("en-US")} of ref ${gpParams.refCount.toLocaleString("en-US")} reviews`}
                math={`log10(1+${it.gp.reviews})/log10(1+${gpParams.refCount})`}
                value={it.gp.volume}
              />
              <FactorRow
                name="QUALITY"
                inputs={it.gp.rating != null ? `${it.gp.rating}★ vs mid ${gpParams.qualityMid.toFixed(2)}★` : "no rating → quality 0"}
                math={
                  it.gp.rating != null
                    ? `1/(1+e^(−${gpParams.qualitySteep.toFixed(1)}·(${it.gp.rating}−${gpParams.qualityMid.toFixed(2)})))`
                    : "cold start, never neutral"
                }
                value={it.gp.quality}
              />
            </div>
            <div className="my-1.5">
              <ConnectorPill>
                raw = {it.gp.volume.toFixed(2)} × {it.gp.quality.toFixed(2)} = {it.gp.raw.toFixed(2)}
              </ConnectorPill>
            </div>
            <div className="border-border/50 overflow-hidden rounded-lg border">
              <LedgerRow
                label={
                  it.gp.floored
                    ? `cold-start floor (${it.gp.reviews} < ${gpParams.minReviews} reviews)`
                    : `cold-start floor (${it.gp.reviews.toLocaleString("en-US")} ≥ ${gpParams.minReviews} reviews — inactive)`
                }
                value={it.gp.floored ? `max(${it.gp.raw.toFixed(2)}, ${gpParams.coldStartFloor.toFixed(2)})` : "—"}
                dim={!it.gp.floored}
              />
              <LedgerRow label="GP" value={it.gp.gp.toFixed(2)} strong />
            </div>
            <ResultLine>
              {it.gp.floored ? (
                <>
                  raw {it.gp.raw.toFixed(2)} → floored to <b>GP {it.gp.gp.toFixed(2)}</b> —
                  unreviewed places stay organically alive
                </>
              ) : (
                <>
                  volume {it.gp.volume.toFixed(2)} × quality {it.gp.quality.toFixed(2)} →{" "}
                  <b>GP {it.gp.gp.toFixed(2)}</b> — multiplies ES in the organic lanes
                </>
              )}
            </ResultLine>
          </ScoreBox>

          {/* IC — where × when */}
          <ScoreBox
            icon={Compass}
            tint="amber"
            title="IC Subscore · Intent Context"
            note="where × when — the intent's numeric context"
            result={it.ic.toFixed(2)}
          >
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
              {it.where.toFixed(2)} × {it.when.toFixed(2)} = <b>IC {it.ic.toFixed(2)}</b> —
              multiplies the match in now-mode, never feeds it
            </ResultLine>
          </ScoreBox>

          {/* RP — rates → posture → rung */}
          <ScoreBox
            icon={BadgePercent}
            tint="rose"
            title="RP Subscore · Rewards Promotions"
            note="live rates → posture → rung"
            result={String(it.rp)}
          >
            <div className="grid grid-cols-4 gap-1.5">
              <RateCell label="welcome · free" value={place.welcome_free_rate} />
              <RateCell label="welcome · prem" value={place.welcome_premium_rate} />
              <RateCell label="returning · free" value={place.free_rate} />
              <RateCell label="returning · prem" value={place.premium_rate} />
            </div>
            <div className="mt-2.5">
              <ConnectorPill>
                posture: {STRATEGIES.find((s) => s.id === it.posture)?.name ?? "Zero"}
              </ConnectorPill>
            </div>
            <ResultLine>
              rung <b>RP {it.rp}</b>
              {it.rp === 0 ? " — not in the paid lane (nothing to promote)" : ""}
            </ResultLine>
          </ScoreBox>

          {/* CH — Swipe-only pair history (stub) */}
          {it.ch != null && run ? (
            <ScoreBox
              icon={History}
              tint="sky"
              title="CH Subscore · Context History"
              note="the consumer × place pair's history — Swipe only"
              result={it.ch.toFixed(2)}
            >
              <p className="text-muted-foreground text-[10.5px] leading-relaxed">
                STUB — always 1, so it moves nothing yet. The contract: did{" "}
                <b>{c?.label ?? "this consumer"}</b> save {place.name}? visit it (paid ticket)?
                skip it n times in the deck? When that history starts boosting/penalizing, its
                knobs join the Subscores tab.
              </p>
              <ResultLine>
                <b>CH {it.ch.toFixed(2)}</b> — multiplies all four Swipe lanes; Map and Pre-Memo
                skip it
              </ResultLine>
            </ScoreBox>
          ) : null}

          {/* The Card — four Scores, one value each */}
          <ScoreBox
            icon={Layers}
            tint="sky"
            title="The Card · four Scores"
            note="one Score per Lane, from the Subscores above"
            className="xl:col-span-2"
          >
            <div className="border-border/50 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[440px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-border/50 border-b">
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Lane</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-left text-[9px] font-bold tracking-[0.08em] uppercase">Formula</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">Score</th>
                    <th className="text-muted-foreground px-2.5 pt-2 pb-1.5 text-right text-[9px] font-bold tracking-[0.08em] uppercase">/ max</th>
                  </tr>
                </thead>
                <tbody>
                  {it.lanes.map(({ lane, score }) => (
                    <tr key={lane.id} className="border-border/40 border-b last:border-0">
                      <td className="px-2.5 py-1.5">
                        <LaneBadge short={LANE_SHORT[lane.id]} title={`${lane.lane} · ${lane.mode}`} />
                      </td>
                      <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[10px]">
                        {laneFormula(lane, run?.intent.engine)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[11px] font-semibold tabular-nums">
                        {score.toFixed(1)}
                      </td>
                      <td className="text-muted-foreground px-2.5 py-1.5 text-right font-mono text-[10px] tabular-nums">
                        {lane.max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScoreBox>
        </div>
      )}
    </SectionCard>
  );
}
