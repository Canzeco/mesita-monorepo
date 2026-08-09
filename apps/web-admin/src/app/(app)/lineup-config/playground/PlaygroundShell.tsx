"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  Dices,
  MapPin,
  MessageSquareText,
  Play,
  Tags,
  UserRound,
} from "lucide-react";
import {
  composeFinalDeck,
  DEFAULT_MANUAL_PRIORITY,
  EM_ENCODER,
  gpParts,
  laneCountsTotal,
  LANES,
  laneScore,
  PLAYGROUND_XX_SEED,
  RANDOMNESS_LEVELS,
  rpScore,
  smParts,
  unitDraw,
  xxControlForLevel,
  xxScore,
  type DeckCandidate,
  type DeckSlot,
  type FinalDeck,
  type GpParams,
  type Lane,
  type LaneId,
  type SmParams,
} from "@/lib/business/scores";
import { strategyForPlace } from "@/lib/business/strategies";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildOpennessArray,
  buildPlaceDoc,
  composeIntent,
  embedText,
  emFromVectors,
  resolveWhere,
  WEEKDAYS,
  whatRelation,
  type Intent,
  type IntentSpec,
  type SamplePlace,
} from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { PanelCard } from "../panel-ui";
import { EmptyCatalog, LaneBadge, SpecimenCell } from "../playground-ui";
import { CardAnatomy, type CardParts } from "./CardAnatomy";

// Playground = ONE Lineup call (Pato 2026-07-21): compose the payload a real
// caller sends — one CONSUMER + one INTENT (Where · When · What · That, plus
// the Randomness override) — press Run, and the result is the ACTUAL sorted
// deck: ≤ ΣN cards after round-robin merge, each expandable into its full
// subscore anatomy. A place is never an input — Lineup scores the whole
// sample catalog. The run SNAPSHOTS the current knobs; editing anything
// afterwards marks the result stale instead of silently recomputing.

const HOUR_OPTIONS = Array.from({ length: 48 }, (_, i) => i / 2);
// The consumer's Randomness rungs — the SAME word ladder the filter shows, and
// the rows of XX's table. The control comes from the table, never typed here.
const RANDOMNESS_OPTIONS = RANDOMNESS_LEVELS.map((label, level) => ({ label, level }));

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Builds one Record<LaneId, T> by running `compute` over every lane. */
function laneRecord<T>(compute: (lane: Lane) => T): Record<LaneId, T> {
  return Object.fromEntries(LANES.map((l) => [l.id, compute(l)])) as Record<LaneId, T>;
}

type Run = {
  key: string;
  intent: Intent;
  ciDoc: string;
  ciVec: number[];
  deck: FinalDeck;
  byId: Map<string, SamplePlace>;
  parts: Map<string, CardParts>;
  /** Knob snapshot at call time — an open card never silently rewrites. */
  snap: { sm: SmParams; gp: GpParams; xxControl: number; total: number };
};

export function PlaygroundShell() {
  const { consumers, places, current } = useScoring();

  const [consumerIdx, setConsumerIdx] = useState(0);
  const [ask, setAsk] = useState("");
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [day, setDay] = useState<string>("friday");
  const [hour, setHour] = useState(20.5);
  const [catAsk, setCatAsk] = useState<string | null>(null);
  /** The consumer's Randomness rung, 0 low … 4 max — 0 is the untouched filter. */
  const [randomness, setRandomness] = useState(0);

  const [run, setRun] = useState<Run | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const zones = useMemo(
    () => [...new Set(places.map((p) => p.zone).filter((z): z is string => !!z))].sort(),
    [places],
  );
  const categories = useMemo(
    () => [...new Set(places.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [places],
  );

  // The full call payload + every knob — any change marks the run stale.
  const payloadKey = JSON.stringify({
    consumerIdx,
    ask,
    zoneName,
    day,
    hour,
    catAsk,
    randomness,
    knobs: current,
  });

  const makeCall = () => {
    const spec: IntentSpec = { ask, zoneName, day, hour, cats: catAsk ? [catAsk] : [] };
    const intent = composeIntent(spec, places);
    const profile = buildConsumerProfile(consumers[consumerIdx] ?? null);
    const ciDoc = buildCiDoc(profile, intent);
    const ciVec = embedText(ciDoc, EM_ENCODER.dims);
    const xxControl = xxControlForLevel(current.xx, randomness);

    const parts = new Map<string, CardParts>();
    const candidates: DeckCandidate[] = places.map((p) => {
      const placeDoc = buildPlaceDoc(p);
      const placeVec = embedText(placeDoc, EM_ENCODER.dims);
      const em = emFromVectors(ciVec, placeVec);
      const w = resolveWhere(intent, p);
      const win = buildOpennessArray(p.hours, intent.day, intent.hour);
      const rel = whatRelation(intent, p);
      const smP = smParts(
        {
          km: w.km,
          tolKm: null,
          zoneMode: w.zoneMode,
          opensInH: win.opensInH,
          openForH: win.openForH,
          openness: win.bits ?? undefined,
          hoursUnknown: win.unknown,
          whatRel: rel,
        },
        current.sm,
      );
      const gpP = gpParts(p.google_review_count, p.google_stars_overall, current.gp);
      const placeStrategy = strategyForPlace({
        welcome_free_rate: p.welcome_free_rate,
        welcome_premium_rate: p.welcome_premium_rate,
        free_rate: p.free_rate,
        premium_rate: p.premium_rate,
      });
      const rpVal = rpScore(placeStrategy, current.rp);
      const mp = p.manual_priority ?? DEFAULT_MANUAL_PRIORITY;
      const draws = laneRecord((l) => unitDraw(PLAYGROUND_XX_SEED, p.id, l.id));
      const xxVals = laneRecord((l) => xxScore(draws[l.id], xxControl));
      const laneScores = laneRecord((l) =>
        laneScore(l, { em, sm: smP.sm, gp: gpP.gp, rp: rpVal, xx: xxVals[l.id], mp }),
      );
      parts.set(p.id, { em, placeDoc, placeVec, w, win, rel, smP, gpP, placeStrategy, rpVal, mp, draws, xxVals, laneScores });
      return { id: p.id, scores: laneScores };
    });

    setRun({
      key: payloadKey,
      intent,
      ciDoc,
      ciVec,
      deck: composeFinalDeck(candidates, current.laneN),
      byId: new Map(places.map((p) => [p.id, p])),
      parts,
      snap: { sm: current.sm, gp: current.gp, xxControl, total: laneCountsTotal(current.laneN) },
    });
    setOpen(null);
  };

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Playground"
        subtitle="Compose a call — consumer + intent — and run Lineup over the sample catalog."
      />
    );
  }

  const selectBase =
    "border-border/70 bg-card rounded-lg border px-2 py-1.5 text-[12px] font-medium";
  const selectCls = selectBase + " w-full";
  const stale = run != null && run.key !== payloadKey;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ The call ═════════════════════════════════════════════════ */}
      <PanelCard
        title="The call · consumer + intent"
        subtitle="What a caller sends Lineup — one consumer, one intent; the catalog is never an input."
      >
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <SpecimenCell icon={UserRound} tone="bg-violet-600 text-white" label="Consumer">
            <select
              aria-label="Consumer"
              className={selectCls}
              value={consumerIdx}
              onChange={(e) => setConsumerIdx(Number(e.target.value))}
            >
              {consumers.length === 0 ? <option value={0}>no consumers — synthetic</option> : null}
              {consumers.map((c, i) => (
                <option key={c.id} value={i}>
                  {c.label ?? c.id.slice(0, 8)} · {c.class_key}
                </option>
              ))}
            </select>
          </SpecimenCell>
          <SpecimenCell icon={MapPin} tone="bg-sky-600 text-white" label="Where">
            <select
              aria-label="Where — named zone or point mode"
              className={selectCls}
              value={zoneName ?? ""}
              onChange={(e) => setZoneName(e.target.value || null)}
            >
              <option value="">point (GPS) — near the sample anchor</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  zone · {z}
                </option>
              ))}
            </select>
          </SpecimenCell>
          <SpecimenCell icon={CalendarClock} tone="bg-rose-600 text-white" label="When">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Day of week"
                className={selectBase + " min-w-0 flex-1 capitalize"}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d} className="capitalize">
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label="Hour"
                className={selectBase + " w-[5.5rem] shrink-0"}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {fmtHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </SpecimenCell>
          <SpecimenCell icon={Tags} tone="bg-indigo-600 text-white" label="What">
            <select
              aria-label="What — category ask"
              className={selectCls}
              value={catAsk ?? ""}
              onChange={(e) => setCatAsk(e.target.value || null)}
            >
              <option value="">nothing asked — what → 1</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </SpecimenCell>
          <SpecimenCell icon={MessageSquareText} tone="bg-slate-600 text-white" label="That · the ask">
            <input
              type="text"
              aria-label="That — the free-text ask (EM's query)"
              className={selectCls}
              placeholder='"mezcal cocktails for a first date"'
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
            />
          </SpecimenCell>
          <SpecimenCell icon={Dices} tone="bg-emerald-600 text-white" label="Randomness">
            <select
              aria-label="Randomness — the consumer's rung (green consumer input)"
              className={selectCls}
              value={randomness}
              onChange={(e) => setRandomness(Number(e.target.value))}
            >
              {RANDOMNESS_OPTIONS.map(({ label, level }) => (
                <option key={label} value={level}>
                  {label} · control {xxControlForLevel(current.xx, level)}
                  {level === 0 ? " (no filter)" : ""}
                </option>
              ))}
            </select>
          </SpecimenCell>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          {stale ? (
            <span className="text-[11px] font-medium text-amber-600">
              inputs or knobs changed since the last call
            </span>
          ) : null}
          <button
            type="button"
            onClick={makeCall}
            className="bg-pink-gradient shadow-save inline-flex h-8 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Run Lineup
          </button>
        </div>
      </PanelCard>

      {/* ══ The result — three decks: the two lanes + the final ═════ */}
      {run == null ? (
        <PanelCard
          title="The decks"
          subtitle="The result of the call — each lane's own deck plus the merged final deck a caller receives."
        >
          <p className="text-muted-foreground mt-4 text-[12px]">
            No call yet — compose the consumer + intent above and Run Lineup.
          </p>
        </PanelCard>
      ) : (
        <PanelCard
          title="The decks · two lanes + the final"
          subtitle="Each lane ranks the WHOLE pool by its own score and takes its top-N; round-robin O → I — on a duplicate, keep pulling from the same lane until a new card lands, then rotate. Click any card for its subscore anatomy."
          pill={`final ${run.deck.slots.length} ≤ ${run.snap.total}`}
        >
          {stale ? (
            <p className="mt-3 text-[11px] font-medium text-amber-600">
              stale — inputs or knobs changed since this call; Run Lineup again
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4">
            {LANES.map((l) => (
              <DeckBlock
                key={l.id}
                deckId={l.id}
                title={`${l.label} deck`}
                laneId={l.id}
                cards={run.deck.lanes[l.id]}
                run={run}
                open={open}
                setOpen={setOpen}
              />
            ))}
            <DeckBlock
              deckId="final"
              title="Final deck · the merged result"
              laneId={null}
              cards={run.deck.slots}
              run={run}
              open={open}
              setOpen={setOpen}
            />
          </div>
        </PanelCard>
      )}
    </div>
  );
}

// One deck's rows — a lane's own top-N (laneId set) or the merged final
// (laneId null). Every card expands into its full subscore anatomy. In a lane
// deck, a card the final took via an EARLIER lane is struck through (merged
// away); the final deck shows each card's provenance-lane badge instead.
function DeckBlock({
  deckId,
  title,
  laneId,
  cards,
  run,
  open,
  setOpen,
}: {
  deckId: string;
  title: string;
  laneId: LaneId | null;
  cards: DeckSlot[];
  run: Run;
  open: string | null;
  setOpen: (k: string | null) => void;
}) {
  const isFinal = laneId == null;
  const fill = laneId ? run.deck.fills[laneId] : null;

  return (
    <div className="border-border/60 overflow-hidden rounded-2xl border">
      <div
        className={
          "border-border/60 flex flex-wrap items-center gap-2 border-b px-3 py-2 " +
          (isFinal ? "bg-muted/60" : "bg-muted/25")
        }
      >
        {laneId ? <LaneBadge laneId={laneId} /> : null}
        <span className={"text-[12.5px] " + (isFinal ? "font-bold" : "font-semibold")}>
          {title}
        </span>
        <span className="text-muted-foreground ml-auto font-mono text-[10px]">
          {fill
            ? `top ${fill.taken} of ${fill.eligible} eligible · ${fill.contributed} in final · ${fill.mergedAway} merged`
            : `${cards.length} cards · ${LANES.map((l) => `${l.label[0]} ${run.deck.fills[l.id].contributed}`).join(" · ")}`}
        </span>
      </div>
      <div className="divide-border/40 flex flex-col divide-y">
        {cards.length === 0 ? (
          <p className="text-muted-foreground px-3 py-2 text-[11px]">
            {isFinal
              ? "empty deck — every lane came up empty at these knobs"
              : "empty — no place scores > 0 in this lane"}
          </p>
        ) : (
          cards.map((slot, i) => {
            const place = run.byId.get(slot.id);
            const parts = run.parts.get(slot.id);
            const key = `${deckId}:${slot.id}`;
            const isOpen = open === key;
            // Struck through only in a lane deck when the final took this place
            // via a different (earlier) lane.
            const merged =
              !isFinal &&
              !run.deck.slots.some((s) => s.id === slot.id && s.laneId === laneId);
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : key)}
                  aria-expanded={isOpen}
                  className={
                    "hover:bg-muted/40 flex w-full items-center gap-2.5 px-3 py-2 text-left transition " +
                    (merged ? "opacity-50" : "")
                  }
                >
                  <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-[10px]">
                    {i + 1}
                  </span>
                  {isFinal ? <LaneBadge laneId={slot.laneId} /> : null}
                  <span
                    className={
                      "min-w-0 flex-1 truncate text-[12.5px] font-medium " +
                      (merged ? "line-through" : "")
                    }
                    title={
                      merged
                        ? "merged away — already in the final deck via an earlier lane"
                        : undefined
                    }
                  >
                    {place?.name ?? slot.id}
                  </span>
                  <span className="shrink-0 font-mono text-[11.5px] font-semibold tabular-nums">
                    {slot.score.toFixed(3)}
                  </span>
                  <ChevronDown
                    className={
                      "text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform " +
                      (isOpen ? "rotate-180" : "")
                    }
                    aria-hidden
                  />
                </button>
                {isOpen && place && parts ? (
                  <CardAnatomy
                    intent={run.intent}
                    ciDoc={run.ciDoc}
                    ciVec={run.ciVec}
                    parts={parts}
                    placeName={place.name}
                    placeCategory={place.category}
                    sm={run.snap.sm}
                    gp={run.snap.gp}
                    xxControl={run.snap.xxControl}
                    provenance={laneId ?? slot.laneId}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
