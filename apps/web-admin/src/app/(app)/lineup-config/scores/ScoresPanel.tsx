"use client";

import Link from "next/link";
import { LANES, SUBSCORE_BY_ID } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { PanelCard, SubHead } from "../panel-ui";
import { LaneBadge } from "../playground-ui";

// Scores — READ-MOSTLY, one card: the three lane formulas with deep-link
// factor chips, then the live definitions at the CURRENT form values (shared
// provider — an unsaved knob edit on Subscores moves the numbers here).

export function ScoresPanel() {
  const { sm, gp, rp, xx } = useScoring();

  return (
    <PanelCard
      title="The three lane scores"
      subtitle="Each lane multiplies its subscores — click a factor to tune it on Subscores."
      pill="formulas locked"
    >
      <div className="mt-4 flex flex-col gap-2">
        {LANES.map((l) => (
          <div
            key={l.id}
            className="border-border/60 bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5"
          >
            <LaneBadge laneId={l.id} />
            <span className="w-24 text-[13px] font-semibold">{l.label}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              {l.parts.map((p, i) => (
                <span key={p} className="flex items-center gap-1.5">
                  <Link
                    href={`/lineup-config/subscores#${p}`}
                    title={`${SUBSCORE_BY_ID[p].name} — tune it on Subscores`}
                    className="border-border/70 bg-card hover:border-primary/50 hover:bg-primary/10 rounded-md border px-2 py-0.5 font-mono text-[12px] font-semibold transition"
                  >
                    {SUBSCORE_BY_ID[p].short}
                  </Link>
                  {i < l.parts.length - 1 ? (
                    <span className="text-muted-foreground text-[11px]" aria-hidden>
                      ·
                    </span>
                  ) : null}
                </span>
              ))}
            </span>
            <span className="text-muted-foreground ml-auto text-[11px]">merit: {l.merit}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 font-mono text-[10.5px]">
        multiply, never blend — a dead factor kills the card
      </p>

      <div className="border-border/40 mt-4 border-t pt-3">
        <SubHead>Live definitions · current form values</SubHead>
        <div className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
          <p>EM = max(0, cos(A, B)) · A = place doc · B = consumer + intent doc · [0,1]</p>
          <p>
            SM = where × when × what · where = 1/(1+(km/tol)^3) · tol = consumer slider (green
            default {sm.where.defaultTolKm.toFixed(1)} km) · when = patience{" "}
            {sm.when.patience.toFixed(2)} over 2×24×7 openness · what tol {sm.what.tol.toFixed(2)}{" "}
            (super = t · none = t²)
          </p>
          <p>
            GP = min(1, ln(1 + ★^{gp.ratingPow.toFixed(1)}·n)/{gp.lnCeiling.toFixed(1)}) · RP
            rungs {rp.zero.toFixed(2)} / {rp.conservative.toFixed(2)} /{" "}
            {rp.aggressive.toFixed(2)} / {rp.dominant.toFixed(2)} · XX = U^
            {xx.control.toFixed(1)}
          </p>
          <p>MP = the place&apos;s manual_priority · per place · default 0.1 · not a global knob</p>
        </div>
      </div>
    </PanelCard>
  );
}
