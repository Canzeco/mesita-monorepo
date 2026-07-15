"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  composeDeck,
  DECK_COUNT_MAX,
  ENGINE_POLICIES,
  gpScore,
  laneScore,
  LANES,
  whenScore,
  whereScore,
  type DeckCandidate,
  type DeckKey,
  type EngineId,
} from "@/lib/business/scores";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  embedText,
  esFromVectors,
  generateIntent,
  haversineKm,
  openWindow,
  type ConsumerProfile,
  type Intent,
  type SamplePlace,
} from "@/lib/business/cip";
import { strategyForPlace } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { LANE_SHORT, PanelCard } from "../panel-ui";
import {
  EmptyCatalog,
  ENGINE_ICONS,
  FactChip,
  LaneBadge,
  ScoreCell,
} from "../playground-ui";

// DECK SIM — counts in, ordered deck out. Pick an engine, set how many cards
// each Lane supplies (the SAME state the Pipeline tab saves), Generate: one
// consumer + one intent, every place scored on all four Lanes, then
// composeDeck claims and orders the cards. Lanes never compete on score —
// cross-lane order is COMPOSITION. Everything recomputes live from the
// Pipeline knobs (shared provider); Generate is deterministic (seed counter).

type DeckRun = { profile: ConsumerProfile; intent: Intent };

type ScoredPlace = {
  place: SamplePlace;
  es: number;
  gp: number;
  rp: number;
  ww: number;
  scores: Record<DeckKey, number>;
};

export function DeckSimPanel() {
  const router = useRouter();
  const {
    consumers,
    places,
    decks,
    setDeckCount,
    cfg,
    gpParams,
    rpVals,
    esParams,
    context,
    dirty,
  } = useScoring();

  const [engine, setEngine] = useState<EngineId>("swipe");
  const [seed, setSeed] = useState(1);
  const [runs, setRuns] = useState<Partial<Record<EngineId, DeckRun>>>({});

  const esSet = useMemo(() => new Set(context.es), [context.es]);

  // Place vectors are intent-independent — embed once per sample per config.
  const placeIndex = useMemo(
    () => new Map(places.map((p) => [p.id, embedText(buildPlaceDoc(p, esSet), esParams.embedDims)])),
    [places, esSet, esParams.embedDims],
  );

  const generate = (e: EngineId) => {
    const s = seed;
    setSeed((x) => x + 1);
    const offset = ENGINE_POLICIES.findIndex((x) => x.id === e);
    const consumer = consumers.length > 0 ? consumers[(s * 7 + offset) % consumers.length] : null;
    const profile = buildConsumerProfile(consumer);
    const intent = generateIntent(e, profile, places, s * 13 + offset * 5);
    setRuns((r) => ({ ...r, [e]: { profile, intent } }));
  };
  const pickEngine = (e: EngineId) => {
    setEngine(e);
    if (runs[e] == null && runs[engine] != null) generate(e);
  };

  const run = runs[engine];

  const result = useMemo(() => {
    if (!run) return null;
    const ciVec = embedText(buildCiDoc(run.profile, run.intent, esSet), esParams.embedDims);

    const scored: ScoredPlace[] = places.map((p) => {
      const pVec = placeIndex.get(p.id) ?? embedText(buildPlaceDoc(p, esSet), esParams.embedDims);
      const es = esFromVectors(ciVec, pVec);
      const gp = gpScore(p.google_review_count, p.google_stars_overall, gpParams);
      const posture = strategyForPlace({
        welcome_free_rate: p.welcome_free_rate,
        welcome_premium_rate: p.welcome_premium_rate,
        free_rate: p.free_rate,
        premium_rate: p.premium_rate,
      });
      const rp = (posture ? rpVals[posture] : rpVals.zero) ?? 0;
      const km =
        run.intent.lat != null && run.intent.lng != null && p.lat != null && p.lng != null
          ? haversineKm(run.intent.lat, run.intent.lng, Number(p.lat), Number(p.lng))
          : null;
      const win = openWindow(p.hours, run.intent.day, run.intent.hour);
      // The Card Sim's neutrality rules, verbatim: unknown geo → where 1
      // (whereScore handles null); unknown hours → when 1 (unknown ≠ closed).
      const where = whereScore(km, cfg);
      const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);
      const ww = where * when;
      const scores = Object.fromEntries(
        LANES.map((lane) => [lane.short, laneScore(lane, { es, gp, rp, ww })]),
      ) as Record<DeckKey, number>;
      return { place: p, es, gp, rp, ww, scores };
    });

    const candidates: DeckCandidate[] = scored.map((s) => ({ id: s.place.id, scores: s.scores }));
    const plan = composeDeck(candidates, decks[engine]);
    const byId = new Map(scored.map((s) => [s.place.id, s]));
    return { scored, plan, byId };
  }, [run, places, placeIndex, esSet, esParams, gpParams, rpVals, cfg, decks, engine]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Deck Sim"
        subtitle="Compose an engine's deck from the four Lanes — counts in, ordered cards out."
      />
    );
  }

  const c = run?.profile.consumer ?? null;
  const counts = decks[engine];
  const deckTotal = LANES.reduce((s, l) => s + counts[l.short], 0);
  const paidPct = deckTotal > 0 ? Math.round(((counts.in + counts.if) / deckTotal) * 100) : 0;

  const shortfalls = result
    ? LANES.filter((l) => result.plan.fills[l.short].taken < result.plan.fills[l.short].requested)
    : [];

  return (
    <PanelCard
      title="Deck Sim"
      subtitle={`Compose ${ENGINE_POLICIES.find((e) => e.id === engine)?.engine}'s deck from the four Lanes — counts in, ordered cards out. Paid lanes claim first (a place strong in both IN and ON is claimed by the PAID lane — that is "visibility follows generosity", not a dedupe bug), then paid cards space evenly through the organic stream.`}
      pill={`n = ${places.length}`}
    >
      {/* ── Query side + engine control ─────────────────────────────── */}
      <div className="border-border/60 from-muted/60 to-card mt-4 rounded-2xl border bg-gradient-to-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="border-border/70 bg-card flex overflow-hidden rounded-full border">
            {ENGINE_POLICIES.map((e) => {
              const Icon = ENGINE_ICONS[e.id];
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={engine === e.id}
                  onClick={() => pickEngine(e.id)}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold transition " +
                    (engine === e.id ? "bg-foreground text-background" : "hover:bg-muted")
                  }
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {e.engine}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.refresh()}
              className="border-border/70 bg-card text-foreground/70 hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition active:scale-[0.98]"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Resample from DB
            </button>
            <button
              type="button"
              onClick={() => generate(engine)}
              className="bg-pink-gradient shadow-save rounded-full px-4 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
            >
              Generate
            </button>
          </div>
        </div>

        {run ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FactChip value={c?.label ?? "synthetic"} strong />
            {c?.age != null ? <FactChip value={`${c.age}y`} /> : null}
            <FactChip value={`${c?.class_key ?? "free"} class`} />
            {run.profile.synthetic ? <FactChip value="taste SYNTH" warn /> : null}
            <span className="text-muted-foreground mx-1 text-[11px]">·</span>
            <span className="max-w-full truncate text-[11.5px] font-medium">
              “{run.intent.parts.query}”
            </span>
            <FactChip label="when" value={run.intent.timeLabel} />
            {run.intent.parts.zone ? <FactChip label="where" value={run.intent.parts.zone} /> : null}
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-[10.5px]">
            Generate picks a consumer, synthesizes an intent{engine === "memo" ? " from a question (Memo's retrieval-augmented leg)" : ""},
            scores every place on all four Lanes, and composes the deck.
          </p>
        )}

        {/* ── Composition strip — the SAME knobs the Pipeline tab saves ── */}
        <div className="border-border/60 bg-card mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5">
          <span className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
            Composition
          </span>
          {LANES.map((l) => (
            <label key={l.id} className="flex items-center gap-1.5">
              <LaneBadge short={LANE_SHORT[l.id]} title={`${l.lane} · ${l.mode}`} />
              <input
                type="number"
                min={0}
                max={DECK_COUNT_MAX}
                step={1}
                value={counts[l.short]}
                onChange={(ev) => setDeckCount(engine, l.short, Number(ev.target.value))}
                aria-label={`${engine} ${LANE_SHORT[l.id]} cards`}
                className="border-border/70 bg-card w-13 rounded-lg border px-1.5 py-1 text-right font-mono text-[12px] tabular-nums"
              />
            </label>
          ))}
          <span className="text-muted-foreground font-mono text-[11px]">
            deck = {deckTotal} cards · paid {paidPct}%
          </span>
          {dirty ? (
            <Link
              href="/scoring-config/params"
              className="text-muted-foreground ml-auto text-[10.5px] underline-offset-2 hover:underline"
            >
              unsaved — Save lives on Pipeline
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Shortfalls — honest, two reasons ────────────────────────── */}
      {result && shortfalls.length > 0 ? (
        <div className="border-amber-200/80 bg-amber-50 text-amber-950 mt-3 rounded-xl border px-3.5 py-2.5 text-[11.5px] leading-relaxed">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            Short lanes — never silently backfilled
          </p>
          <ul className="mt-1 space-y-0.5">
            {shortfalls.map((l) => {
              const f = result.plan.fills[l.short];
              const short = f.requested - f.taken;
              // `eligible` counts LANE-SCORE > 0 — for a paid lane that means
              // ES AND RP (and WW in now-mode) all > 0, so never phrase it as
              // "has RP > 0": a promo-active place with ES 0 would make that
              // a lie, in exactly the case an operator would investigate.
              const factors =
                l.lane === "inorganic"
                  ? ` (needs ES · RP${l.mode === "now" ? " · WW" : ""} all > 0)`
                  : "";
              const reason =
                f.claimedByEarlier > 0
                  ? `${f.claimedByEarlier} eligible place${f.claimedByEarlier === 1 ? "" : "s"} already claimed by earlier lanes`
                  : `only ${f.eligible} place${f.eligible === 1 ? "" : "s"} score${f.eligible === 1 ? "s" : ""} > 0 in this lane${factors}`;
              return (
                <li key={l.id} className="font-mono text-[10.5px]">
                  {LANE_SHORT[l.id]} {f.taken}/{f.requested} (−{short}) — {reason}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {result?.plan.degradedSpacing ? (
        <p className="mt-2 text-[11px] font-medium text-amber-700">
          Spacing degraded — not enough organic cards to space the paid ones (surplus appended at
          the tail).
        </p>
      ) : null}

      {/* ── The deck ────────────────────────────────────────────────── */}
      {!result ? (
        <div className="border-border/60 text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-[12px]">
          Generate to run: consumer → intent → every place scored on all four Lanes →
          composeDeck.
        </div>
      ) : result.plan.slots.length === 0 ? (
        <div className="border-border/60 text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-[12px]">
          The deck came out empty — every requested lane is short (see above). Raise a count or
          check why nothing scores &gt; 0.
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {result.plan.slots.map((slot, i) => {
            const s = result.byId.get(slot.id);
            if (!s) return null;
            return (
              <div
                key={`${slot.id}-${slot.laneKey}`}
                className={
                  "border-border/60 bg-card flex items-center gap-3 rounded-xl border px-3 py-2 " +
                  (slot.paid ? "border-l-4 border-l-pink-400/80" : "")
                }
              >
                <span
                  className={
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10.5px] font-bold " +
                    (i === 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
                  }
                >
                  {i + 1}
                </span>
                <LaneBadge
                  short={LANE_SHORT[LANES.find((l) => l.short === slot.laneKey)!.id]}
                  title={`claimed by the ${slot.laneKey.toUpperCase()} lane`}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                  {s.place.name}
                </span>
                <div className="hidden w-56 shrink-0 grid-cols-4 gap-1 sm:grid">
                  <ScoreCell label="ES" value={String(s.es)} hint="Embeddings Similarity — cosine(CI, place) × 100" />
                  <ScoreCell label="GP" value={s.gp.toFixed(2)} hint="Google Popularity — volume × quality" />
                  <ScoreCell label="RP" value={String(s.rp)} hint="Rewards Promotions — posture from live rates" />
                  <ScoreCell label="WW" value={s.ww.toFixed(2)} hint="the moment — where × when" />
                </div>
                <span
                  className="font-display shrink-0 text-base font-semibold tabular-nums"
                  title={`${slot.laneKey.toUpperCase()} Score — the claiming lane's value`}
                >
                  {slot.score.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Doctrine ────────────────────────────────────────────────── */}
      <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
        order across lanes is COMPOSITION, not comparison — each lane ranks only against itself;
        paid cards space evenly (slot 1 organic, never two paid adjacent while paid ≤ organic).
        sample = {places.length} places; decks asking more than the pool WILL come up short here.
      </p>
    </PanelCard>
  );
}
