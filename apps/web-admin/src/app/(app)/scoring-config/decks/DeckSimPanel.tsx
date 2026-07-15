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

// DECKS — maxes in, ordered deck out, through the sub-deck pipeline:
//
//   1 · SUB-DECKS  each lane independently takes its top-MAX cards by its
//       own Score (in parallel when live) — no cross-lane dedupe yet.
//   2 · MERGE      the four sub-decks merge into ONE deck, repeated places
//       removed. A duplicated card keeps its PAID copy; nothing backfills,
//       so the deck is usually SMALLER than the sum of the maxes — that is
//       the design, not a shortfall.
//   3 · ORDER      paid cards space evenly through the organic stream.
//
// The max steppers ARE the same form state the Subscores tab saves (shared
// provider). Generate is deterministic (seed counter). Memo's deck is
// PRE-MEMO — the retrieval set the concierge consumes before answering.

type DeckRun = { profile: ConsumerProfile; intent: Intent };

type ScoredPlace = {
  place: SamplePlace;
  es: number;
  gp: number;
  rp: number;
  ic: number;
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
  const policy = ENGINE_POLICIES.find((e) => e.id === engine)!;

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
      // The Cards tab's neutrality rules, verbatim: unknown geo → where 1
      // (whereScore handles null); unknown hours → when 1 (unknown ≠ closed).
      const where = whereScore(km, cfg);
      const when = win.unknown ? 1 : whenScore(win.opensInH, win.openForH, cfg);
      const ic = where * when;
      const scores = Object.fromEntries(
        LANES.map((lane) => [lane.short, laneScore(lane, { es, gp, rp, ic })]),
      ) as Record<DeckKey, number>;
      return { place: p, es, gp, rp, ic, scores };
    });

    const candidates: DeckCandidate[] = scored.map((s) => ({ id: s.place.id, scores: s.scores }));
    const plan = composeDeck(candidates, decks[engine]);
    const byId = new Map(scored.map((s) => [s.place.id, s]));
    // Which lane kept each place — for the "merged → kept by X" notes.
    const keptBy = new Map(plan.slots.map((slot) => [slot.id, slot.laneKey]));
    return { scored, plan, byId, keptBy };
  }, [run, places, placeIndex, esSet, esParams, gpParams, rpVals, cfg, decks, engine]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Decks"
        subtitle="Maxes in, ordered deck out — sub-decks per lane, merged, repeats removed."
      />
    );
  }

  const c = run?.profile.consumer ?? null;
  const maxes = decks[engine];
  const maxTotal = LANES.reduce((s, l) => s + maxes[l.short], 0);

  const mergeNotes = result
    ? LANES.filter((l) => {
        const f = result.plan.fills[l.short];
        return f.max > 0 && (f.subDeck < f.max || f.mergedAway > 0);
      })
    : [];

  return (
    <PanelCard
      title="Decks"
      subtitle={`Compose the ${policy.deck} deck. Per-lane MAXES, not quotas: every lane fills its own sub-deck independently, the sub-decks merge into one deck removing repeated places (the paid copy wins), and nothing backfills — a deck is usually smaller than the sum of its maxes, by design.`}
      pill={`n = ${places.length}`}
    >
      {/* ── Query side + deck control ───────────────────────────────── */}
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
                  {e.deck}
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
            Generate picks a consumer, synthesizes an intent
            {engine === "memo" ? " from a question (the Pre-Memo deck is Memo's retrieval set)" : ""},
            scores every place on all four Lanes, fills the sub-decks, and merges.
          </p>
        )}

        {/* ── Max strip — the SAME knobs the Subscores tab saves ──────── */}
        <div className="border-border/60 bg-card mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2.5">
          <span className="text-muted-foreground text-[9.5px] font-bold tracking-[0.1em] uppercase">
            Max per lane
          </span>
          {LANES.map((l) => (
            <label key={l.id} className="flex items-center gap-1.5">
              <LaneBadge short={LANE_SHORT[l.id]} title={`${l.lane} · ${l.mode}`} />
              <input
                type="number"
                min={0}
                max={DECK_COUNT_MAX}
                step={1}
                value={maxes[l.short]}
                onChange={(ev) => setDeckCount(engine, l.short, Number(ev.target.value))}
                aria-label={`${policy.deck} ${LANE_SHORT[l.id]} max cards`}
                className="border-border/70 bg-card w-13 rounded-lg border px-1.5 py-1 text-right font-mono text-[12px] tabular-nums"
              />
            </label>
          ))}
          <span className="text-muted-foreground font-mono text-[11px]">
            Σ max = {maxTotal}
            {result ? ` · deck = ${result.plan.slots.length}` : ""}
          </span>
          {dirty ? (
            <Link
              href="/scoring-config/subscores"
              className="text-muted-foreground ml-auto text-[10.5px] underline-offset-2 hover:underline"
            >
              unsaved — Save lives on Subscores
            </Link>
          ) : null}
        </div>
      </div>

      {!result ? (
        <div className="border-border/60 text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-[12px]">
          Generate to run: consumer → intent → four Scores per place → sub-decks → merge →
          the deck.
        </div>
      ) : (
        <>
          {/* ── 1 · The sub-decks, as generated ─────────────────────── */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {LANES.map((l) => {
              const f = result.plan.fills[l.short];
              const sub = result.plan.subDecks[l.short];
              return (
                <div key={l.id} className="border-border/60 bg-card rounded-xl border px-2.5 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <LaneBadge short={LANE_SHORT[l.id]} title={`${l.lane} · ${l.mode}`} />
                      <span className="text-muted-foreground text-[9.5px] font-bold tracking-[0.08em] uppercase">
                        sub-deck
                      </span>
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {f.subDeck}/{f.max} max
                    </span>
                  </div>
                  {sub.length === 0 ? (
                    <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">
                      {f.max === 0 ? "max 0 — lane off" : "nothing scores > 0"}
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-0.5">
                      {sub.map((slot, i) => {
                        const mergedAway = result.keptBy.get(slot.id) !== slot.laneKey;
                        const keeper = result.keptBy.get(slot.id);
                        return (
                          <li
                            key={slot.id}
                            className={
                              "flex items-baseline justify-between gap-2 font-mono text-[10.5px] " +
                              (mergedAway ? "text-muted-foreground/60 line-through" : "")
                            }
                            title={
                              mergedAway && keeper
                                ? `merged away — kept by the ${keeper.toUpperCase()} sub-deck`
                                : undefined
                            }
                          >
                            <span className="min-w-0 truncate">
                              {i + 1}. {result.byId.get(slot.id)?.place.name ?? slot.id}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {slot.score.toFixed(1)}
                              {mergedAway && keeper ? (
                                <span className="no-underline"> → {keeper.toUpperCase()}</span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 2 · Merge report — shrinkage is the design ───────────── */}
          {mergeNotes.length > 0 ? (
            <div className="border-border/60 bg-muted/40 text-muted-foreground mt-2 rounded-xl border px-3.5 py-2.5 text-[11px] leading-relaxed">
              <p className="text-foreground/70 font-semibold">
                Merge report — maxes are ceilings, not quotas; nothing backfills
              </p>
              <ul className="mt-1 space-y-0.5 font-mono text-[10.5px]">
                {mergeNotes.map((l) => {
                  const f = result.plan.fills[l.short];
                  const bits: string[] = [];
                  if (f.subDeck < f.max) {
                    bits.push(
                      l.lane === "inorganic"
                        ? `sub-deck ${f.subDeck}/${f.max} — only ${f.eligible} score > 0 in this lane (needs ES · RP${l.mode === "now" ? " · IC" : ""} all > 0)`
                        : `sub-deck ${f.subDeck}/${f.max} — only ${f.eligible} score > 0 in this lane`,
                    );
                  }
                  if (f.mergedAway > 0) {
                    bits.push(
                      `${f.mergedAway} merged away (same place kept by an earlier sub-deck) → contributed ${f.contributed}`,
                    );
                  }
                  return (
                    <li key={l.id}>
                      {LANE_SHORT[l.id]} {bits.join(" · ")}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {result.plan.degradedSpacing ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Spacing degraded — not enough organic cards to space the paid ones (surplus appended
              at the tail).
            </p>
          ) : null}

          {/* ── 3 · The deck ─────────────────────────────────────────── */}
          {result.plan.slots.length === 0 ? (
            <div className="border-border/60 text-muted-foreground mt-3 rounded-xl border border-dashed px-4 py-6 text-center text-[12px]">
              The deck came out empty — every sub-deck is empty (see the merge report). Raise a
              max or check why nothing scores &gt; 0.
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
                      title={`from the ${slot.laneKey.toUpperCase()} sub-deck`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                      {s.place.name}
                    </span>
                    <div className="hidden w-56 shrink-0 grid-cols-4 gap-1 sm:grid">
                      <ScoreCell label="ES" value={String(s.es)} hint="Embeddings Similarity — cosine(CI, place) × 100" />
                      <ScoreCell label="GP" value={s.gp.toFixed(2)} hint="Google Popularity — volume × quality" />
                      <ScoreCell label="RP" value={String(s.rp)} hint="Rewards Promotions — posture from live rates" />
                      <ScoreCell label="IC" value={s.ic.toFixed(2)} hint="Intent Context — where × when" />
                    </div>
                    <span
                      className="font-display shrink-0 text-base font-semibold tabular-nums"
                      title={`${slot.laneKey.toUpperCase()} Score — its sub-deck's value`}
                    >
                      {slot.score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Doctrine ────────────────────────────────────────────────── */}
      <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
        sub-decks fill independently (in parallel when live); the merge keeps a duplicated card&apos;s
        PAID copy — &quot;visibility follows generosity&quot;; nothing backfills, so deck ≤ Σ max by design.
        order across lanes is COMPOSITION, not comparison (slot 1 organic, never two paid adjacent
        while paid ≤ organic). sample = {places.length} places; maxes above the pool WILL come up
        short here.
      </p>
    </PanelCard>
  );
}
