"use client";

import { Dices, MapPin, MessageSquareText, Store } from "lucide-react";
import {
  EM_ENCODER,
  LANES,
  MISMATCH_RUNG,
  type GpParams,
  type LaneId,
  type SmParams,
  type SmParts,
} from "@/lib/business/scores";
import { STRATEGY_BY_ID, type StrategyId } from "@/lib/business/strategies";
import type { Intent } from "@/lib/business/cip";
import {
  FactorRow,
  LedgerRow,
  MatchStrip,
  ResultLine,
  ScoreBox,
  SemanticProfile,
} from "../playground-ui";
import { LaneBadge } from "../playground-ui";

// One deck card's FULL anatomy — every subscore's internal process for THIS
// place, computed at CALL time (the run snapshots the knobs, so a knob edit
// after the call never silently rewrites an open card). Rendered inside the
// expanded card on the Playground's deck.

/** Everything the run stores per candidate — the expansion reads only this. */
export type CardParts = {
  em: number;
  placeDoc: string;
  placeVec: number[];
  w: { km: number | null; zoneMode: boolean };
  win: { opensInH: number; openForH: number; unknown: boolean };
  rel: string;
  smP: SmParts;
  gpP: { reviews: number; rating: number | null; raw: number; gp: number };
  posture: StrategyId | null;
  rpVal: number;
  draws: Record<LaneId, number>;
  xxVals: Record<LaneId, number>;
  laneScores: Record<LaneId, number>;
};

const pct = (v: number) => v.toFixed(2);

export function CardAnatomy({
  intent,
  ciDoc,
  ciVec,
  parts,
  placeName,
  placeCategory,
  sm,
  gp,
  xxControl,
  provenance,
}: {
  intent: Intent;
  ciDoc: string;
  ciVec: number[];
  parts: CardParts;
  placeName: string;
  placeCategory: string | null;
  sm: SmParams;
  gp: GpParams;
  xxControl: number;
  provenance: LaneId;
}) {
  return (
    <div className="border-border/60 border-t px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <ScoreBox
          icon={MessageSquareText}
          tint="sky"
          title="EM · Embeddings Match"
          note={`${EM_ENCODER.dims}d emulated encoder · fixed context`}
          result={pct(parts.em)}
          className="lg:col-span-2"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <SemanticProfile
              entity="B · Consumer + Intent entity"
              doc={ciDoc}
              empty="(no text fields with data)"
              vec={ciVec}
              tone="violet"
            />
            <SemanticProfile
              entity={`A · Place entity — ${placeName}`}
              doc={parts.placeDoc}
              empty="(no text fields with data)"
              vec={parts.placeVec}
              tone="emerald"
            />
          </div>
          <MatchStrip a={ciVec} b={parts.placeVec} className="mt-3" />
          <ResultLine>
            cos(A, B) → EM = <b>{pct(parts.em)}</b> · unit vectors, so cos is a plain dot
            product
          </ResultLine>
        </ScoreBox>

        <ScoreBox
          icon={MapPin}
          tint="emerald"
          title="SM · Structured Match"
          note="where × when × what"
          result={pct(parts.smP.sm)}
        >
          <FactorRow
            name="where"
            inputs={
              parts.w.km == null
                ? "no geo — never punish missing data"
                : parts.w.km === 0
                  ? `inside W (zone “${intent.zoneName}” matched)`
                  : `${parts.w.km.toFixed(1)} km to W · ${parts.w.zoneMode ? "zone spillover" : "point mode"} · tol ${parts.smP.tolKm.toFixed(1)} km`
            }
            math={`1/(1+(km/${parts.smP.tolKm.toFixed(1)})^${sm.where.distExp.toFixed(1)})`}
            value={parts.smP.where}
          />
          <FactorRow
            name="when"
            inputs={
              parts.win.unknown
                ? "hours unknown — neutral 1"
                : parts.win.opensInH === 0
                  ? `open now · ${parts.win.openForH.toFixed(1)} h left`
                  : `opens in ${parts.win.opensInH.toFixed(1)} h · then ${parts.win.openForH.toFixed(1)} h`
            }
            math={`wait ${pct(parts.smP.wait)} × fit ${pct(parts.smP.fit)}`}
            value={parts.smP.when}
          />
          <FactorRow
            name="what"
            inputs={
              parts.rel === "none"
                ? "nothing asked → 1"
                : `${parts.rel} · place is ${placeCategory ?? "uncategorized"}`
            }
            math={`ladder 1 / ${sm.what.sibling.toFixed(2)} / ${MISMATCH_RUNG.toFixed(2)}`}
            value={parts.smP.what}
          />
          <ResultLine>
            {pct(parts.smP.where)} × {pct(parts.smP.when)} × {pct(parts.smP.what)} → SM ={" "}
            <b>{pct(parts.smP.sm)}</b>
          </ResultLine>
        </ScoreBox>

        <ScoreBox
          icon={Store}
          tint="amber"
          title="GP · Google Popularity"
          note={`ln(1 + ★·n) / ${gp.lnCeiling.toFixed(1)}`}
          result={pct(parts.gpP.gp)}
        >
          <LedgerRow label="reviews · n" value={parts.gpP.reviews.toLocaleString("en-US")} />
          <LedgerRow
            label="rating · ★"
            value={parts.gpP.rating != null ? parts.gpP.rating.toFixed(1) : "—"}
          />
          <LedgerRow
            label="star mass · ★ × n"
            value={parts.gpP.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          />
          <LedgerRow label={`ln(1 + raw) / ${gp.lnCeiling.toFixed(1)}`} value={pct(parts.gpP.gp)} strong />
          <ResultLine>
            GP = <b>{pct(parts.gpP.gp)}</b>
            {parts.gpP.reviews === 0 ? " · no Google presence → out of the organic lane" : null}
          </ResultLine>
        </ScoreBox>

        <ScoreBox
          icon={Store}
          tint="rose"
          title="RP · Rewards Promotions"
          note="live rates → posture → rung"
          result={pct(parts.rpVal)}
        >
          <LedgerRow
            label="posture (from the four live rates)"
            value={parts.posture ? STRATEGY_BY_ID[parts.posture].name : "custom → zero rung"}
          />
          <LedgerRow label="rung" value={pct(parts.rpVal)} strong />
          <ResultLine>
            RP = <b>{pct(parts.rpVal)}</b> · non-members never enter the paid lanes at all
          </ResultLine>
        </ScoreBox>

        <ScoreBox
          icon={Dices}
          tint="violet"
          title="XX · Random Number"
          note={`U^${xxControl.toFixed(1)} · per card per lane · seeded`}
          result={xxControl === 0 ? "1.00 (off)" : undefined}
          className="lg:col-span-2"
        >
          {LANES.map((l) => (
            <FactorRow
              key={l.id}
              name={l.label}
              inputs={`U = ${parts.draws[l.id].toFixed(3)}`}
              math={`U^${xxControl.toFixed(1)}`}
              value={parts.xxVals[l.id]}
            />
          ))}
        </ScoreBox>
      </div>

      {/* The card's three lane scores — its deck lane bolded */}
      <div className="border-border/60 mt-3 rounded-xl border px-3 py-2.5">
        <div className="grid gap-1.5 sm:grid-cols-3">
          {LANES.map((l) => (
            <div
              key={l.id}
              className={"flex items-center gap-2" + (l.id === provenance ? "" : " opacity-60")}
            >
              <LaneBadge laneId={l.id} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[10px]">
                {l.parts
                  .map((p) =>
                    p === "em"
                      ? pct(parts.em)
                      : p === "sm"
                        ? pct(parts.smP.sm)
                        : p === "gp"
                          ? pct(parts.gpP.gp)
                          : p === "rp"
                            ? pct(parts.rpVal)
                            : pct(parts.xxVals[l.id]),
                  )
                  .join(" × ")}
              </span>
              <span
                className={
                  "font-mono text-[13px] tabular-nums " +
                  (l.id === provenance ? "font-bold" : "font-medium")
                }
              >
                {parts.laneScores[l.id].toFixed(3)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-1.5 font-mono text-[9.5px]">
          bold = the lane this card entered the deck through
        </p>
      </div>
    </div>
  );
}
