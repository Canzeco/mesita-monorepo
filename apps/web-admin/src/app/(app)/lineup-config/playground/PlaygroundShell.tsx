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
  EM_ENCODER,
  gpParts,
  laneCountsTotal,
  LANES,
  laneScore,
  rpScore,
  smParts,
  unitDraw,
  xxScore,
  type DeckCandidate,
  type FinalDeck,
  type GpParams,
  type LaneId,
  type SmParams,
} from "@/lib/business/scores";
import { strategyForPlace } from "@/lib/business/strategies";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  composeIntent,
  embedText,
  emFromVectors,
  openWindow,
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
// 0.1 steps (0.0 … 5.0) — decimal-by-decimal randomness, matching the XX knob.
const RANDOMNESS_OPTIONS = Array.from({ length: 51 }, (_, i) => i / 10);

function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
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
  /** null = the admin default (XX's green knob). */
  const [randomness, setRandomness] = useState<number | null>(null);

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
    const xxControl = randomness ?? current.xx.control;

    const parts = new Map<string, CardParts>();
    const candidates: DeckCandidate[] = places.map((p) => {
      const placeDoc = buildPlaceDoc(p);
      const placeVec = embedText(placeDoc, EM_ENCODER.dims);
      const em = emFromVectors(ciVec, placeVec);
      const w = resolveWhere(intent, p);
      const win = openWindow(p.hours, intent.day, intent.hour);
      const rel = whatRelation(intent, p);
      const smP = smParts(
        {
          km: w.km,
          tolKm: null,
          zoneMode: w.zoneMode,
          opensInH: win.opensInH,
          openForH: win.openForH,
          hoursUnknown: win.unknown,
          whatRel: rel,
        },
        current.sm,
      );
      const gpP = gpParts(p.google_review_count, p.google_stars_overall, current.gp);
      const posture = strategyForPlace({
        welcome_free_rate: p.welcome_free_rate,
        welcome_premium_rate: p.welcome_premium_rate,
        free_rate: p.free_rate,
        premium_rate: p.premium_rate,
      });
      const rpVal = rpScore(posture, current.rp);
      const draws = Object.fromEntries(
        LANES.map((l) => [l.id, unitDraw(p.id, l.id, 1)]),
      ) as Record<LaneId, number>;
      const xxVals = Object.fromEntries(
        LANES.map((l) => [l.id, xxScore(draws[l.id], xxControl)]),
      ) as Record<LaneId, number>;
      const laneScores = Object.fromEntries(
        LANES.map((l) => [
          l.id,
          laneScore(l, { em, sm: smP.sm, gp: gpP.gp, rp: rpVal, xx: xxVals[l.id] }),
        ]),
      ) as Record<LaneId, number>;
      parts.set(p.id, { em, placeDoc, placeVec, w, win, rel, smP, gpP, posture, rpVal, draws, xxVals, laneScores });
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
              aria-label="Randomness — XX control override (green consumer input)"
              className={selectCls}
              value={randomness ?? ""}
              onChange={(e) =>
                setRandomness(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">admin default · {current.xx.control.toFixed(1)}</option>
              {RANDOMNESS_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v.toFixed(1)}
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

      {/* ══ The result — the sorted deck ═════════════════════════════ */}
      {run == null ? (
        <PanelCard
          title="The deck"
          subtitle="The result of the call — the sorted, merged deck a caller receives."
        >
          <p className="text-muted-foreground mt-4 text-[12px]">
            No call yet — compose the consumer + intent above and Run Lineup.
          </p>
        </PanelCard>
      ) : (
        <PanelCard
          title="The deck · the sorted result"
          subtitle="Round-robin O → I → H, dedupe on insert, no backfill — click a card for its full subscore anatomy."
          pill={`${run.deck.slots.length} cards ≤ ${run.snap.total}`}
        >
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-muted-foreground font-mono text-[10px]">
              {LANES.map(
                (l) => `${l.label[0]} ${run.deck.fills[l.id].contributed}`,
              ).join(" · ")}{" "}
              · {LANES.reduce((s, l) => s + run.deck.fills[l.id].mergedAway, 0)} merged away
            </span>
            {stale ? (
              <span className="text-[11px] font-medium text-amber-600">
                stale — inputs or knobs changed; run again
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {run.deck.slots.map((slot, i) => {
              const place = run.byId.get(slot.id);
              const parts = run.parts.get(slot.id);
              const isOpen = open === slot.id;
              return (
                <div key={slot.id} className="border-border/60 overflow-hidden rounded-xl border">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : slot.id)}
                    aria-expanded={isOpen}
                    className="hover:bg-muted/40 flex w-full items-center gap-2.5 px-3 py-2 text-left transition"
                  >
                    <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-[10px]">
                      {i + 1}
                    </span>
                    <LaneBadge laneId={slot.laneId} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
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
                      provenance={slot.laneId}
                    />
                  ) : null}
                </div>
              );
            })}
            {run.deck.slots.length === 0 ? (
              <p className="text-muted-foreground py-1 text-[11px]">
                empty deck — every lane came up empty at these knobs
              </p>
            ) : null}
          </div>
        </PanelCard>
      )}
    </div>
  );
}
