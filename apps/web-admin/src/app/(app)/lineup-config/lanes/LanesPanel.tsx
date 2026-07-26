"use client";

import Link from "next/link";
import { ArrowRight, Cog } from "lucide-react";
import {
  LANE_N_MAX,
  laneCountsTotal,
  LANES,
  MERGE_ROTATION,
  LINEUP_ENGINE,
  SUBSCORE_BY_ID,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { BoxSaveBar, MiniTile, PanelCard, Slider, SubHead } from "../panel-ui";
import { LaneBadge } from "../playground-ui";

// Composition — how the deck is built, in ONE card: the two lane FORMULAS
// (locked; each factor chip deep-links to its subscore box), then the per-lane
// counts + the merge (the one knob here). A second card is the Lineup engine
// reference (Engine · Callers · Consumer inputs). Subscore knobs live on the
// boxes above; simulators on the Playground. (Pato 2026-07-26: folded the old
// Scores + Lanes tabs together and dropped the redundant live-definitions dump
// — every formula already resolves live inside its own subscore box.)

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
    resetSection,
  } = useScoring();
  const total = laneCountsTotal(laneN);

  return (
    <div className="flex flex-col gap-5">
      {/* ══ How the deck composes — formulas + counts + merge ═════════ */}
      <PanelCard
        title="How the deck composes"
        subtitle="Each lane multiplies its subscores, takes its own top-N, then the lanes round-robin into one deck."
        pill={`deck ≤ ${total}`}
      >
        {/* Lane scores — the two formulas, locked; chips deep-link to a box. */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <SubHead>Lane scores</SubHead>
            <span className="text-muted-foreground text-[11px]">
              formulas locked · click a factor to open its box
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-2">
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
                        href={`/lineup-config/config#${p}`}
                        title={`${SUBSCORE_BY_ID[p].name} — jump to its box`}
                        className="border-border/70 bg-card hover:border-primary/50 hover:bg-primary/10 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[12px] font-semibold transition"
                      >
                        <span aria-hidden>{SUBSCORE_BY_ID[p].emoji}</span>
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
          <p className="text-muted-foreground mt-2 font-mono text-[10.5px]">
            multiply, never blend — a dead factor kills the card
          </p>
        </div>

        {/* Deck counts + the merge — the one knob on this card. */}
        <div className="border-border/40 mt-5 border-t pt-4">
          <SubHead>Deck counts · the merge</SubHead>
          <div className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              {LANES.map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="w-24 shrink-0">
                    <LaneBadge laneId={l.id} />
                  </span>
                  <div className="min-w-0 max-w-xs flex-1">
                    <Slider
                      label={`${l.label} · N`}
                      value={String(laneN[l.id])}
                      min={0}
                      max={LANE_N_MAX}
                      step={1}
                      v={laneN[l.id]}
                      onChange={(n) => setLaneN(l.id, n)}
                      hint={laneN[l.id] === 0 ? "0 — lane off, contributes nothing" : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <SubHead>Rotation</SubHead>
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
              <div>
                <SubHead>On duplicate</SubHead>
                <p className="text-muted-foreground mt-1.5 text-[12px] leading-snug">
                  Card already in the final deck → skip it and keep pulling from{" "}
                  <span className="text-foreground font-medium">this lane</span> until a new card
                  lands (or the lane is empty), then rotate. Never skip the turn to the next lane —
                  that starves Inorganic when its tops already arrived from Organic.
                </p>
              </div>
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
          onReset={() => resetSection("lanes")}
        />
      </PanelCard>

      {/* ══ Lineup — engine · callers · consumer inputs (reference) ═══ */}
      <PanelCard
        title="Lineup · the one engine"
        subtitle="One engine, two lanes, three callers — Swipe and Map call it directly, Memo calls it as a tool."
      >
        <div className="mt-4">
          <SubHead>Engine</SubHead>
          <div className="border-border/60 bg-muted/40 mt-2 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
              <Cog className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-[13px] font-semibold">{LINEUP_ENGINE.name}</span>
            <span className="flex items-center gap-1.5">
              {LANES.map((l) => (
                <LaneBadge key={l.id} laneId={l.id} />
              ))}
            </span>
            <span className="text-foreground/80 min-w-0 flex-1 text-[12px]">
              {LINEUP_ENGINE.composition}
            </span>
          </div>
        </div>
        <div className="border-border/40 mt-4 border-t pt-3">
          <SubHead>Callers</SubHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {LINEUP_ENGINE.callers.map((s) => (
              <MiniTile key={s.caller} label={s.caller}>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  intent: {s.intent}
                </p>
              </MiniTile>
            ))}
          </div>
        </div>
        <div className="border-border/40 mt-4 border-t pt-3">
          <SubHead>Consumer inputs · Where · When · What · That · Randomness</SubHead>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Where", owner: "SM · where", detail: "zone or point + tolerance" },
              { name: "When", owner: "SM · when", detail: "target time vs open windows" },
              { name: "What", owner: "SM · what", detail: "category set — the ladder" },
              { name: "That", owner: "EM · the ask", detail: "free text — EM embeds it" },
              { name: "Randomness", owner: "XX · control", detail: "luck 0–5 — no-filter default" },
            ].map((f) => (
              <MiniTile key={f.name} label={f.name}>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] font-bold">
                  → {f.owner}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{f.detail}</p>
              </MiniTile>
            ))}
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
