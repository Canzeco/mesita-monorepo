"use client";

import { useMemo, useState } from "react";
import { Dices, MessageSquareText, UserRound } from "lucide-react";
import {
  composeFinalDeck,
  EM_ENCODER,
  gpParts,
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
  generateIntent,
  openWindow,
  resolveWhere,
  whatRelation,
  type IntentStyle,
  type SamplePlace,
} from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { PanelCard, SubHead } from "../panel-ui";
import { EmptyCatalog, INTENT_STYLE_ICONS, FactChip, LaneBadge, SpecimenCell } from "../playground-ui";

// The Deck playground — one full run of the STANDARD ENGINE (the one
// engine): score EVERY sampled place in all three lanes at the CURRENT
// knobs, fill each lane's top-N, merge round-robin O → I → H with
// dedupe-on-insert and no backfill, and show the final deck. The whole
// pipeline (subscores × lane composition × merge), end to end.

const INTENT_STYLES: readonly IntentStyle[] = ["browse", "viewport", "question"];

export function DeckPlayground() {
  const { consumers, places, laneN, sm, gp, rp, xx, dataAccess, context } = useScoring();

  const [consumerIdx, setConsumerIdx] = useState(0);
  const [style, setStyle] = useState<IntentStyle>("browse");
  const [roll, setRoll] = useState(1);

  const consumer = consumers[consumerIdx] ?? null;

  const run = useMemo(() => {
    if (places.length === 0) return null;
    const profile = buildConsumerProfile(consumer);
    const intent = generateIntent(style, profile, places, consumerIdx * 7 + roll);
    const enabled = new Set(context.em);
    // The data-access matrix, enforced across the whole pool.
    const emSrc = {
      consumer: dataAccess.em.includes("consumer"),
      intent: dataAccess.em.includes("intent"),
      place: dataAccess.em.includes("place"),
    };
    const smLive = dataAccess.sm.includes("place") && dataAccess.sm.includes("intent");
    const gpOn = dataAccess.gp.includes("place");
    const rpOn = dataAccess.rp.includes("place");
    const ciVec = embedText(
      buildCiDoc(profile, intent, enabled, { consumer: emSrc.consumer, intent: emSrc.intent }),
      EM_ENCODER.dims,
    );

    const byId = new Map<string, SamplePlace>(places.map((p) => [p.id, p]));
    const candidates: DeckCandidate[] = places.map((p) => {
      const emVal = emFromVectors(
        ciVec,
        embedText(buildPlaceDoc(p, enabled, emSrc.place), EM_ENCODER.dims),
      );
      const w = smLive ? resolveWhere(intent, p) : { km: null, zoneMode: false };
      const win = smLive
        ? openWindow(p.hours, intent.day, intent.hour)
        : { opensInH: 0, openForH: 0, unknown: true };
      const smVal = smScore(
        {
          km: w.km,
          zoneMode: w.zoneMode,
          opensInH: win.opensInH,
          openForH: win.openForH,
          hoursUnknown: win.unknown,
          whatRel: smLive ? whatRelation(intent, p) : "none",
        },
        sm,
      );
      const gpVal = gpParts(
        gpOn ? p.google_review_count : null,
        gpOn ? p.google_stars_overall : null,
        gp,
      ).gp;
      const posture = rpOn
        ? strategyForPlace({
            welcome_free_rate: p.welcome_free_rate,
            welcome_premium_rate: p.welcome_premium_rate,
            free_rate: p.free_rate,
            premium_rate: p.premium_rate,
          })
        : null;
      const rpVal = rpScore(posture, rp);
      const scores = Object.fromEntries(
        LANES.map((l) => [
          l.id,
          laneScore(l, {
            em: emVal,
            sm: smVal,
            gp: gpVal,
            rp: rpVal,
            xx: xxScore(unitDraw(p.id, l.id, roll), xx.control),
          }),
        ]),
      ) as Record<LaneId, number>;
      return { id: p.id, scores };
    });

    const deck = composeFinalDeck(candidates, laneN);
    return { intent, deck, byId };
  }, [consumer, consumerIdx, places, style, roll, context.em, sm, gp, rp, xx, dataAccess, laneN]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Deck playground"
        subtitle="Generate the three lanes over the whole sample, merge them, and view the final deck."
      />
    );
  }

  const StyleIcon = INTENT_STYLE_ICONS[style];
  const selectCls =
    "border-border/70 bg-card w-full rounded-lg border px-2 py-1.5 text-[12px] font-medium";

  return (
    <PanelCard
      title="Deck playground"
      subtitle="One full run at the CURRENT knobs: every sampled place scored in all three lanes → each lane's top-N → round-robin merge with dedupe (first occurrence wins) and no backfill. Struck-through cards were merged away — the place already arrived via an earlier lane."
      pill={`deck ≤ ${laneN * 3} of ${places.length} places`}
    >
      {/* Specimen bar */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
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
        <SpecimenCell icon={StyleIcon} tone="bg-sky-600 text-white" label="Intent">
          <div className="flex items-center gap-1.5">
            {INTENT_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                aria-pressed={style === s}
                className={
                  "rounded-md border px-2 py-1 text-[11px] font-semibold capitalize transition active:scale-[0.97] " +
                  (style === s
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 text-muted-foreground hover:text-foreground")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </SpecimenCell>
        <SpecimenCell icon={Dices} tone="bg-amber-600 text-white" label="Roll">
          <button
            type="button"
            onClick={() => setRoll((r) => r + 1)}
            className="border-border/70 hover:bg-muted inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]"
          >
            <Dices className="h-3.5 w-3.5" aria-hidden /> Re-roll intent + XX · #{roll}
          </button>
        </SpecimenCell>
      </div>

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
                      {fill.taken}/{laneN} · {fill.eligible} eligible
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
