"use client";

import { ArrowRight } from "lucide-react";
import {
  ENGINE_CONTAINERS,
  LANE_N_MAX,
  laneFormula,
  LANES,
  MERGE_ROTATION,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { GroupHead, PanelCard, Slider, SubHead } from "../panel-ui";
import { ENGINE_ICONS, LaneBadge } from "../playground-ui";
import { DeckPlayground } from "./DeckPlayground";

// Scores & Lanes — the composition layer. The lane FORMULAS are locked
// (2026-07-16): what's tunable here is the shared lane length N; the
// subscores' own knobs live on the Subscores tab (shared provider, so both
// tabs and both playgrounds always agree).

export function LanesPanel() {
  const { laneN, setLaneN } = useScoring();

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* ══ Lane composition ═════════════════════════════════════════ */}
      <PanelCard
        title="Lane composition · score = product of subscores"
        subtitle="Three lanes, one score each — every subscore lands in [0,1], so a lane score is [0,1] too. EM and SM multiply in every lane (never blend): semantically dead OR structurally infeasible → the card dies. The inorganic lane is the organic one with bought merit (RP) swapped in for earned (GP); Hybrid carries both."
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
              <span className="font-mono text-[13px] font-semibold tracking-tight">
                {laneFormula(l)}
              </span>
              <span className="text-muted-foreground ml-auto text-[11px]">merit: {l.merit}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 font-mono text-[10.5px] leading-relaxed">
          XX draws independently per lane — three draws per card. RP applies only to places in
          the rewards program: non-members never enter Inorganic/Hybrid at all (a lane filter,
          not a score).
        </p>
      </PanelCard>

      {/* ══ Merge ════════════════════════════════════════════════════ */}
      <PanelCard
        title="Merge · three lanes → the final deck"
        subtitle="Each lane ranks the pool by its own score and takes its top-N (N shared across lanes). Round-robin one card at a time — identical for Swipe and Map — dedupe ON INSERT (first occurrence wins; O leads, so organic keeps dupes), NO backfill: the deck is ≤ 3·N and shrinks as lanes agree. Shrinkage is signal, not defect."
      >
        <div className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          <div className="max-w-xs">
            <Slider
              label="Lane length · N"
              value={String(laneN)}
              min={1}
              max={LANE_N_MAX}
              step={1}
              v={laneN}
              onChange={setLaneN}
              hint={`each lane contributes up to ${laneN} cards → final deck ≤ ${laneN * 3}`}
            />
          </div>
          <div>
            <SubHead>Rotation · locked 2026-07-16</SubHead>
            <div className="mt-2 flex items-center gap-2">
              {MERGE_ROTATION.map((id, i) => (
                <span key={id} className="flex items-center gap-2">
                  <LaneBadge laneId={id} />
                  {i < MERGE_ROTATION.length - 1 ? (
                    <ArrowRight className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
                  ) : null}
                </span>
              ))}
              <span className="text-muted-foreground ml-2 text-[11px]">
                repeat · the deck leads with pure merit
              </span>
            </div>
          </div>
        </div>
      </PanelCard>

      {/* ══ Engines ══════════════════════════════════════════════════ */}
      <PanelCard
        title="Engines · containers, not formulas"
        subtitle="Swipe and Map compose the three lanes exactly as above and differ only in where intent-data comes from. Memo is free/dynamic — indexes + RAG, decomposing the five subscores however the question needs; its own knobs live in Memo Config."
      >
        <div className="mt-4 flex flex-col gap-2">
          {ENGINE_CONTAINERS.map((e) => {
            const Icon = ENGINE_ICONS[e.id];
            return (
              <div
                key={e.id}
                className="border-border/60 bg-muted/40 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="w-16 text-[13px] font-semibold">{e.engine}</span>
                <span className="text-foreground/80 min-w-0 flex-1 text-[12px]">{e.composition}</span>
                <span className="text-muted-foreground text-[11px]">intent: {e.intent}</span>
              </div>
            );
          })}
        </div>
      </PanelCard>

      {/* ══ The Deck playground ══════════════════════════════════════ */}
      <DeckPlayground />

      <GroupHead>
        Lanes never compete on score — cross-lane deck order is composition, never comparison.
      </GroupHead>
    </div>
  );
}
