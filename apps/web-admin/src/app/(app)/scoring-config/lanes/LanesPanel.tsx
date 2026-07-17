"use client";

import { ArrowRight, Cog } from "lucide-react";
import {
  LANE_N_MAX,
  laneCountsTotal,
  laneFormula,
  LANES,
  MERGE_ROTATION,
  STANDARD_ENGINE,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { BoxSaveBar, GroupHead, PanelCard, Slider, SubHead } from "../panel-ui";
import { LaneBadge } from "../playground-ui";
import { DeckPlayground } from "./DeckPlayground";

// Scores & Lanes — the composition layer. The lane FORMULAS are locked
// (2026-07-16): what's tunable here is each lane's deck count (per-lane N,
// MESITA-659); the subscores' own knobs live on the Subscores tab (shared
// provider, so both tabs and both playgrounds always agree).

export function LanesPanel() {
  const {
    laneN,
    setLaneN,
    sectionDirty,
    savingSection,
    saveError,
    savedSection,
    saveSection,
    revertSection,
    resetToDefaults,
  } = useScoring();
  const total = laneCountsTotal(laneN);

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
        subtitle="Each lane ranks the pool by its own score and takes its OWN top-N — the counts below are per lane, and 0 turns a lane off (e.g. no paid cards). Round-robin one card at a time — identical for Swipe and Map — dedupe ON INSERT (first occurrence wins; O leads, so organic keeps dupes), NO backfill: the deck is ≤ the counts' sum and shrinks as lanes agree. Shrinkage is signal, not defect."
        pill={`deck ≤ ${total}`}
      >
        <div className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            {LANES.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0">
                  <LaneBadge laneId={l.id} />
                </span>
                <div className="min-w-0 flex-1 max-w-xs">
                  <Slider
                    label={`${l.label} · N`}
                    value={String(laneN[l.id])}
                    min={0}
                    max={LANE_N_MAX}
                    step={1}
                    v={laneN[l.id]}
                    onChange={(n) => setLaneN(l.id, n)}
                    hint={
                      laneN[l.id] === 0
                        ? "0 — lane off, contributes nothing"
                        : `up to ${laneN[l.id]} cards`
                    }
                  />
                </div>
              </div>
            ))}
            <p className="text-muted-foreground font-mono text-[10.5px]">
              final deck ≤ {laneN.organic} + {laneN.inorganic} + {laneN.hybrid} ={" "}
              {total} cards
            </p>
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
        <BoxSaveBar
          dirty={sectionDirty.lanes}
          saving={savingSection === "lanes"}
          savedOk={savedSection === "lanes"}
          error={savingSection === "lanes" || sectionDirty.lanes ? saveError : null}
          onSave={() => saveSection("lanes")}
          onCancel={() => revertSection("lanes")}
        />
      </PanelCard>

      {/* ══ The Standard Engine ══════════════════════════════════════ */}
      <PanelCard
        title="The Standard Engine · the one engine"
        subtitle="There is exactly ONE engine. The Standard Engine consists of the three lanes — Organic · Inorganic · Hybrid — merged as above. Swipe, Map and Memo are SURFACES, not engines: each runs the Standard Engine and differs only in where its intent-data comes from."
        pill="1 engine · 3 lanes"
      >
        <div className="border-border/60 bg-muted/40 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
            <Cog className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[13px] font-semibold">{STANDARD_ENGINE.name}</span>
          <span className="flex items-center gap-1.5">
            {LANES.map((l) => (
              <LaneBadge key={l.id} laneId={l.id} />
            ))}
          </span>
          <span className="text-foreground/80 min-w-0 flex-1 text-[12px]">
            {STANDARD_ENGINE.composition}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {STANDARD_ENGINE.surfaces.map((s) => (
            <div key={s.surface} className="border-border/60 rounded-xl border px-3 py-2">
              <p className="text-[12px] font-semibold">{s.surface}</p>
              <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                intent: {s.intent}
              </p>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* ══ Filters ══════════════════════════════════════════════════ */}
      <PanelCard
        title="Filters · Where · When · What · Randomness"
        subtitle="The consumer-facing filter row and where each filter lands in the model. Where/When/What are SM's intent-side inputs — the filters ARE the structured ask; Randomness sets XX's control per query. These are the CONSUMER's knobs — the admin configures only their no-filter defaults; none of them is a separate scoring stage."
      >
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Where", owner: "SM · where", detail: "zone / anchor set + tolerated distance (the consumer slider, point mode only)" },
            { name: "When", owner: "SM · when", detail: "target time vs the place's open windows — wait × fit" },
            { name: "What", owner: "SM · what", detail: "category / mega-category set — the ladder 1 / 0.6 / 0.2" },
            { name: "Randomness", owner: "XX · control", detail: "the CONSUMER's luck knob, 0 (off) … 5 (chaos) — the admin only sets the no-filter default (XX box)" },
          ].map((f) => (
            <div key={f.name} className="border-border/60 bg-muted/40 rounded-xl border px-3 py-2.5">
              <p className="text-[12px] font-semibold">{f.name}</p>
              <p className="mt-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                → {f.owner}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{f.detail}</p>
            </div>
          ))}
        </div>
      </PanelCard>

      {/* ══ Defaults ═════════════════════════════════════════════════ */}
      <PanelCard
        title="Defaults"
        subtitle="Both Ranking Config pages share ONE form — this loads the code defaults into every box on Subscores AND Scores & Lanes; each box stays unsaved until ITS own Save."
      >
        <div className="mt-4">
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={savingSection != null}
            className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            Reset all boxes to defaults
          </button>
          <span className="text-muted-foreground ml-3 text-xs">
            nothing is written until a box&apos;s Save — Cancel on any box reverts just that box
          </span>
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
