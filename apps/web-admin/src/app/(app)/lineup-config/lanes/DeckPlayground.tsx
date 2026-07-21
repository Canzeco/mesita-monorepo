"use client";

import { useMemo } from "react";
import { MessageSquareText } from "lucide-react";
import {
  composeFinalDeck,
  EM_ENCODER,
  gpParts,
  laneCountsTotal,
  LANES,
  laneScore,
  rpScore,
  smScore,
  unitDraw,
  xxScore,
  type DeckCandidate,
  type LaneId,
} from "@/lib/business/scores";
import { strategyForPlace } from "@/lib/business/strategies";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  embedText,
  emFromVectors,
  openWindow,
  resolveWhere,
  whatRelation,
  type SamplePlace,
} from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { PanelCard, SubHead } from "../panel-ui";
import { EmptyCatalog, FactChip, LaneBadge, type PlaygroundSpecimen } from "../playground-ui";

// The Deck playground — one full run of LINEUP (the one engine): score EVERY
// sampled place in all three lanes at the CURRENT knobs, fill each lane's
// top-N, merge round-robin O → I → H with dedupe-on-insert and no backfill,
// and show the final deck. The whole pipeline (subscores × lane composition
// × merge), end to end. The specimen (consumer × intent) comes from the
// Playground page's SHARED bar; the bar's place picker is n = 1-only and
// ignored here. XX draws are pinned to one seeded roll.

export function DeckPlayground({ specimen }: { specimen: PlaygroundSpecimen }) {
  const { consumers, places, laneN, sm, gp, rp, xx } = useScoring();

  const { consumerIdx, intent } = specimen;

  const consumer = consumers[consumerIdx] ?? null;

  const run = useMemo(() => {
    if (places.length === 0) return null;
    const profile = buildConsumerProfile(consumer);
    // Inputs are FIXED (v10): the builders always assemble every live field.
    const ciVec = embedText(buildCiDoc(profile, intent), EM_ENCODER.dims);

    const byId = new Map<string, SamplePlace>(places.map((p) => [p.id, p]));
    const candidates: DeckCandidate[] = places.map((p) => {
      const emVal = emFromVectors(ciVec, embedText(buildPlaceDoc(p), EM_ENCODER.dims));
      const w = resolveWhere(intent, p);
      const win = openWindow(p.hours, intent.day, intent.hour);
      const smVal = smScore(
        {
          km: w.km,
          tolKm: null,
          zoneMode: w.zoneMode,
          opensInH: win.opensInH,
          openForH: win.openForH,
          hoursUnknown: win.unknown,
          whatRel: whatRelation(intent, p),
        },
        sm,
      );
      const gpVal = gpParts(p.google_review_count, p.google_stars_overall, gp).gp;
      const posture = strategyForPlace({
        welcome_free_rate: p.welcome_free_rate,
        welcome_premium_rate: p.welcome_premium_rate,
        free_rate: p.free_rate,
        premium_rate: p.premium_rate,
      });
      const rpVal = rpScore(posture, rp);
      const scores = Object.fromEntries(
        LANES.map((l) => [
          l.id,
          laneScore(l, {
            em: emVal,
            sm: smVal,
            gp: gpVal,
            rp: rpVal,
            xx: xxScore(unitDraw(p.id, l.id, 1), xx.control),
          }),
        ]),
      ) as Record<LaneId, number>;
      return { id: p.id, scores };
    });

    const deck = composeFinalDeck(candidates, laneN);
    return { intent, deck, byId };
  }, [consumer, places, intent, sm, gp, rp, xx, laneN]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Deck playground"
        subtitle="Generate the three lanes over the whole sample, merge them, and view the final deck."
      />
    );
  }

  return (
    <PanelCard
      title="Deck playground · the full run"
      subtitle="Every sampled place scored in all three lanes at the CURRENT knobs → each lane's top-N → round-robin merge with dedupe (first occurrence wins) and no backfill. Struck-through cards were merged away — the place already arrived via an earlier lane."
      pill={`deck ≤ ${laneCountsTotal(laneN)} of ${places.length} places`}
    >
      {run ? (
        <>
          <div className="border-border/60 bg-muted/40 mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2">
            <MessageSquareText className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
            <span className="font-mono text-[11px]">{run.intent.text}</span>
            {run.intent.zoneName ? <FactChip label="zone" value={run.intent.zoneName} strong /> : null}
          </div>

          {/* The three lanes as generated */}
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {LANES.map((l) => {
              const fill = run.deck.fills[l.id];
              return (
                <div key={l.id} className="border-border/60 rounded-xl border">
                  <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
                    <LaneBadge laneId={l.id} />
                    <span className="text-[12px] font-semibold">{l.label}</span>
                    <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                      {fill.taken}/{laneN[l.id]} · {fill.eligible} eligible
                    </span>
                  </div>
                  <div className="px-2 py-1.5">
                    {run.deck.lanes[l.id].length === 0 ? (
                      <p className="text-muted-foreground px-1 py-1 text-[11px]">
                        empty — no place scores &gt; 0 here
                      </p>
                    ) : (
                      run.deck.lanes[l.id].map((slot, i) => {
                        const kept = run.deck.slots.some(
                          (s) => s.id === slot.id && s.laneId === l.id,
                        );
                        return (
                          <div
                            key={slot.id}
                            className={
                              "flex items-baseline gap-2 px-1 py-0.5 " +
                              (kept ? "" : "opacity-45 line-through")
                            }
                            title={kept ? undefined : "merged away — arrived earlier via another lane"}
                          >
                            <span className="text-muted-foreground w-4 shrink-0 text-right font-mono text-[9.5px]">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11.5px]">
                              {run.byId.get(slot.id)?.name ?? slot.id}
                            </span>
                            <span className="shrink-0 font-mono text-[10.5px] tabular-nums">
                              {slot.score.toFixed(3)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The merged final deck */}
          <div className="border-border/60 mt-4 rounded-xl border">
            <div className="border-border/60 flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <SubHead>Final deck · round-robin O → I → H · dedupe on insert · no backfill</SubHead>
              <span className="text-muted-foreground ml-auto font-mono text-[10px]">
                {run.deck.slots.length} cards ·{" "}
                {LANES.map((l) => `${l.label[0]} ${run.deck.fills[l.id].contributed}`).join(" · ")} ·{" "}
                {LANES.reduce((s, l) => s + run.deck.fills[l.id].mergedAway, 0)} merged away
              </span>
            </div>
            <div className="grid gap-x-6 px-3 py-2 sm:grid-cols-2">
              {run.deck.slots.map((slot, i) => (
                <div key={`${slot.laneId}-${slot.id}`} className="flex items-baseline gap-2 py-0.5">
                  <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-[10px]">
                    {i + 1}
                  </span>
                  <LaneBadge laneId={slot.laneId} />
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    {run.byId.get(slot.id)?.name ?? slot.id}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums">
                    {slot.score.toFixed(3)}
                  </span>
                </div>
              ))}
              {run.deck.slots.length === 0 ? (
                <p className="text-muted-foreground py-1 text-[11px]">
                  empty deck — every lane came up empty at these knobs
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </PanelCard>
  );
}
