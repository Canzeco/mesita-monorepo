"use client";

import Link from "next/link";
import { LANES, SUBSCORE_BY_ID } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { PanelCard } from "../panel-ui";
import { LaneBadge } from "../playground-ui";

// Scores — READ-MOSTLY: how the five subscores multiply into the three lane
// scores. No save bar on this page; every factor chip deep-links to its box
// on Subscores. The live definitions render the CURRENT form values (shared
// provider), so an unsaved knob edit over there moves the numbers here.

export function ScoresPanel() {
  const { sm, gp, rp, xx } = useScoring();

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ The three lane scores ════════════════════════════════════ */}
      <PanelCard
        title="The three lane scores"
        subtitle="Each lane multiplies its subscores — every factor is [0,1], so a lane score is [0,1] too. Click a factor to tune it on Subscores."
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
        <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
          multiply, never blend: semantically dead OR structurally infeasible → the card dies —
          money can&apos;t buy irrelevance. XX draws independently per lane (three draws per
          card). RP applies only to rewards members: non-members never enter Inorganic/Hybrid at
          all (a lane filter, not a score).
        </p>
      </PanelCard>

      {/* ══ Live definitions ═════════════════════════════════════════ */}
      <PanelCard
        title="Live definitions"
        subtitle="The formulas at the CURRENT form values — edit a knob on Subscores and watch these move; saving stays per-box over there."
      >
        <div className="mt-4 flex flex-col gap-1 font-mono text-[11px]">
          <p>EM = max(0, cos(A, B)) · A = place doc · B = consumer + intent doc · [0,1]</p>
          <p>
            SM = where × when × what · where = 1/(1+(km/tol)^{sm.where.distExp.toFixed(1)}) · tol
            = consumer slider (green default {sm.where.defaultTolKm.toFixed(1)} km) · wait ={" "}
            {sm.when.waitFloor.toFixed(2)} + {(1 - sm.when.waitFloor).toFixed(2)}/(1+(h/2)^4) · fit
            = min(1, h/{sm.when.sessionH.toFixed(1)}) · 30-min blocks
          </p>
          <p>
            GP = min(1, ln(1 + ★·n)/{gp.lnCeiling.toFixed(1)}) · RP rungs {rp.zero.toFixed(2)} /{" "}
            {rp.conservative.toFixed(2)} / {rp.aggressive.toFixed(2)} / {rp.dominant.toFixed(2)} ·
            XX = U^{xx.control.toFixed(1)}
          </p>
          <p>
            EM reads TEXT only — SM · GP · RP · XX are the numeric subscores; they multiply EM,
            never feed it
          </p>
        </div>
        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
          Saved to app_settings.scoring_config — a saved config overrides the code defaults; NULL
          follows them.
        </p>
      </PanelCard>
    </div>
  );
}
