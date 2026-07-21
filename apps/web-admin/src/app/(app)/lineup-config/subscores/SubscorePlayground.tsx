"use client";

import { useMemo, useState } from "react";
import { Dices, MapPin, MessageSquareText, Store } from "lucide-react";
import {
  EM_ENCODER,
  gpParts,
  LANES,
  laneScore,
  MISMATCH_RUNG,
  rpScore,
  smParts,
  SUBSCORES,
  unitDraw,
  xxScore,
  type LaneId,
  type SubscoreId,
} from "@/lib/business/scores";
import { strategyForPlace, STRATEGY_BY_ID } from "@/lib/business/strategies";
import {
  buildCiDoc,
  buildConsumerProfile,
  buildPlaceDoc,
  embedText,
  emFromVectors,
  openWindow,
  resolveWhere,
  whatRelation,
} from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { PanelCard, SubHead } from "../panel-ui";
import {
  EmptyCatalog,
  FactorRow,
  LaneBadge,
  LedgerRow,
  MatchStrip,
  ResultLine,
  ScoreBox,
  SemanticProfile,
  type PlaygroundSpecimen,
} from "../playground-ui";

// The Subscore playground — simulate the subscores on ONE consumer × intent
// × place specimen (the Playground page's SHARED specimen bar; this section
// is the n = 1 half). Every box is that subscore's ACTUAL internal process
// at the CURRENT knobs (the shared provider): EM assembles + embeds the real
// documents, SM resolves km/hours/category, GP reads the real google
// numbers, RP the live rates, XX its seeded draws. Focus chips narrow to one
// subscore; the lane footer shows the three products.

const pct = (v: number) => v.toFixed(2);

export function SubscorePlayground({ specimen }: { specimen: PlaygroundSpecimen }) {
  const { consumers, places, sm, gp, rp, xx } = useScoring();

  const { consumerIdx, placeIdx, intent } = specimen;
  const [focus, setFocus] = useState<SubscoreId | "all">("all");

  const consumer = consumers[consumerIdx] ?? null;
  const place = places[placeIdx] ?? null;

  const run = useMemo(() => {
    if (!place) return null;
    const profile = buildConsumerProfile(consumer);

    // Inputs are FIXED (v10): the builders always assemble every live field.
    const ciDoc = buildCiDoc(profile, intent);
    const placeDoc = buildPlaceDoc(place);
    const ciVec = embedText(ciDoc, EM_ENCODER.dims);
    const placeVec = embedText(placeDoc, EM_ENCODER.dims);
    const emVal = emFromVectors(ciVec, placeVec);

    const w = resolveWhere(intent, place);
    const win = openWindow(place.hours, intent.day, intent.hour);
    const rel = whatRelation(intent, place);
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
      sm,
    );

    const gpP = gpParts(place.google_review_count, place.google_stars_overall, gp);

    const posture = strategyForPlace({
      welcome_free_rate: place.welcome_free_rate,
      welcome_premium_rate: place.welcome_premium_rate,
      free_rate: place.free_rate,
      premium_rate: place.premium_rate,
    });
    const rpVal = rpScore(posture, rp);

    // XX draws pinned to one seeded roll — deterministic per (card, lane).
    const draws = Object.fromEntries(
      LANES.map((l) => [l.id, unitDraw(place.id, l.id, 1)]),
    ) as Record<LaneId, number>;
    const xxVals = Object.fromEntries(
      LANES.map((l) => [l.id, xxScore(draws[l.id], xx.control)]),
    ) as Record<LaneId, number>;

    const laneScores = Object.fromEntries(
      LANES.map((l) => [
        l.id,
        laneScore(l, { em: emVal, sm: smP.sm, gp: gpP.gp, rp: rpVal, xx: xxVals[l.id] }),
      ]),
    ) as Record<LaneId, number>;

    return { profile, intent, ciDoc, placeDoc, ciVec, placeVec, emVal, w, win, rel, smP, gpP, posture, rpVal, draws, xxVals, laneScores };
  }, [consumer, place, intent, sm, gp, rp, xx]);

  if (places.length === 0) {
    return (
      <EmptyCatalog
        title="Subscore playground"
        subtitle="Simulate any subscore's internals on one consumer × intent × place."
      />
    );
  }

  const show = (id: SubscoreId) => focus === "all" || focus === id;

  return (
    <PanelCard
      title="Subscore playground · n = 1"
      subtitle="Every subscore's internal process on the specimen above, at the CURRENT knobs."
      pill={`n = 1 of ${places.length}`}
    >
      {run ? (
        <>
          {/* Focus chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFocus("all")}
              aria-pressed={focus === "all"}
              className={
                "rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-bold transition " +
                (focus === "all"
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/60 text-muted-foreground hover:text-foreground")
              }
            >
              ALL
            </button>
            {SUBSCORES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setFocus(s.id)}
                aria-pressed={focus === s.id}
                className={
                  "rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-bold transition " +
                  (focus === s.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 text-muted-foreground hover:text-foreground")
                }
              >
                {s.short}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {show("em") ? (
              <ScoreBox
                icon={MessageSquareText}
                tint="sky"
                title="EM · Embeddings Match"
                note={`${EM_ENCODER.dims}d emulated encoder · fixed context`}
                result={pct(run.emVal)}
                className="lg:col-span-2"
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  <SemanticProfile
                    entity="B · Consumer + Intent entity"
                    doc={run.ciDoc}
                    empty="(no text fields with data)"
                    vec={run.ciVec}
                    tone="violet"
                  />
                  <SemanticProfile
                    entity="A · Place entity"
                    doc={run.placeDoc}
                    empty="(no text fields with data)"
                    vec={run.placeVec}
                    tone="emerald"
                  />
                </div>
                <MatchStrip a={run.ciVec} b={run.placeVec} className="mt-3" />
                <ResultLine>
                  cos(A, B) = {run.emVal < 0 ? "negative → clamped" : pct(run.emVal)} → EM ={" "}
                  <b>{pct(run.emVal)}</b> · unit vectors, so cos is a plain dot product
                </ResultLine>
              </ScoreBox>
            ) : null}

            {show("sm") ? (
              <ScoreBox
                icon={MapPin}
                tint="emerald"
                title="SM · Structured Match"
                note="where × when × what"
                result={pct(run.smP.sm)}
              >
                <FactorRow
                  name="where"
                  inputs={
                    run.w.km == null
                      ? "no geo — never punish missing data"
                      : run.w.km === 0
                        ? `inside W (zone “${run.intent.zoneName}” matched)`
                        : `${run.w.km.toFixed(1)} km to W · ${run.w.zoneMode ? "zone spillover" : "point mode"} · tol ${run.smP.tolKm.toFixed(1)} km`
                  }
                  math={`1/(1+(km/${run.smP.tolKm.toFixed(1)})^${sm.where.distExp.toFixed(1)})`}
                  value={run.smP.where}
                />
                <FactorRow
                  name="when"
                  inputs={
                    run.win.unknown
                      ? "hours unknown — neutral 1"
                      : run.win.opensInH === 0
                        ? `open now · ${run.win.openForH.toFixed(1)} h left`
                        : `opens in ${run.win.opensInH.toFixed(1)} h · then ${run.win.openForH.toFixed(1)} h`
                  }
                  math={`wait ${pct(run.smP.wait)} × fit ${pct(run.smP.fit)}`}
                  value={run.smP.when}
                />
                <FactorRow
                  name="what"
                  inputs={
                    run.rel === "none"
                      ? "nothing asked → 1"
                      : `${run.rel} · place is ${place?.category ?? "uncategorized"}`
                  }
                  math={`ladder 1 / ${sm.what.sibling.toFixed(2)} / ${MISMATCH_RUNG.toFixed(2)}`}
                  value={run.smP.what}
                />
                <ResultLine>
                  {pct(run.smP.where)} × {pct(run.smP.when)} × {pct(run.smP.what)} → SM ={" "}
                  <b>{pct(run.smP.sm)}</b>
                </ResultLine>
              </ScoreBox>
            ) : null}

            {show("gp") ? (
              <ScoreBox
                icon={Store}
                tint="amber"
                title="GP · Google Popularity"
                note={`ln(1 + ★·n) / ${gp.lnCeiling.toFixed(1)}`}
                result={pct(run.gpP.gp)}
              >
                <LedgerRow label="reviews · n" value={run.gpP.reviews.toLocaleString("en-US")} />
                <LedgerRow label="rating · ★" value={run.gpP.rating != null ? run.gpP.rating.toFixed(1) : "—"} />
                <LedgerRow
                  label="star mass · ★ × n"
                  value={run.gpP.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                />
                <LedgerRow
                  label={`ln(1 + raw) / ${gp.lnCeiling.toFixed(1)}`}
                  value={pct(run.gpP.gp)}
                  strong
                />
                <ResultLine>
                  GP = <b>{pct(run.gpP.gp)}</b>
                  {run.gpP.reviews === 0 ? " · no Google presence → out of the organic lane" : null}
                </ResultLine>
              </ScoreBox>
            ) : null}

            {show("rp") ? (
              <ScoreBox
                icon={Store}
                tint="rose"
                title="RP · Rewards Promotions"
                note="live rates → posture → rung"
                result={pct(run.rpVal)}
              >
                <LedgerRow
                  label="posture (from the four live rates)"
                  value={run.posture ? STRATEGY_BY_ID[run.posture].name : "custom → zero rung"}
                />
                <LedgerRow label="rung" value={pct(run.rpVal)} strong />
                <ResultLine>
                  RP = <b>{pct(run.rpVal)}</b> · non-members never enter the paid lanes at all
                </ResultLine>
              </ScoreBox>
            ) : null}

            {show("xx") ? (
              <ScoreBox
                icon={Dices}
                tint="violet"
                title="XX · Random Number"
                note={`U^${xx.control.toFixed(1)} · per card per lane · seeded`}
                result={xx.control === 0 ? "1.00 (off)" : undefined}
              >
                {LANES.map((l) => (
                  <FactorRow
                    key={l.id}
                    name={l.label}
                    inputs={`U = ${run.draws[l.id].toFixed(3)}`}
                    math={`U^${xx.control.toFixed(1)}`}
                    value={run.xxVals[l.id]}
                  />
                ))}
                <ResultLine>
                  control {xx.control.toFixed(1)} — {xx.control === 0 ? "off: every lane draws 1" : "independent draw per lane"}
                </ResultLine>
              </ScoreBox>
            ) : null}
          </div>

          {/* Lane footer — the three products for this card */}
          <div className="border-border/60 mt-3 rounded-xl border px-3 py-2.5">
            <SubHead>This card&apos;s three lane scores</SubHead>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {LANES.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <LaneBadge laneId={l.id} />
                  <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
                    {l.parts
                      .map((p) =>
                        p === "em"
                          ? pct(run.emVal)
                          : p === "sm"
                            ? pct(run.smP.sm)
                            : p === "gp"
                              ? pct(run.gpP.gp)
                              : p === "rp"
                                ? pct(run.rpVal)
                                : pct(run.xxVals[l.id]),
                      )
                      .join(" × ")}
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums">
                    {run.laneScores[l.id].toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </PanelCard>
  );
}
