"use client";

import { ArrowRight, Cog } from "lucide-react";
import {
  LANE_N_MAX,
  laneCountsTotal,
  LANES,
  MERGE_ROTATION,
  LINEUP_ENGINE,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { BoxSaveBar, MiniTile, PanelCard, Slider, SubHead } from "../panel-ui";
import { LaneBadge } from "../playground-ui";

// Lanes — COMPOSE the deck: per-lane counts + the merge (the one knob here),
// then ONE reference card (Engine · Callers · Consumer inputs). Lane FORMULAS
// live on Scores; subscore knobs on Subscores; simulators on Playground.

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
      {/* ══ Merge ════════════════════════════════════════════════════ */}
      <PanelCard
        title="Per-lane deck counts · the merge"
        subtitle="Each lane takes its own top-N; round-robin O → I — on a duplicate keep pulling from the same lane, then rotate. A short deck means the lanes agree."
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
                <span className="text-foreground font-medium">this lane</span> until
                a new card lands (or the lane is empty), then rotate. Never skip
                the turn to the next lane — that starves Inorganic when its tops
                already arrived from Organic.
              </p>
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

      {/* ══ Lineup — engine · callers · consumer inputs ══════════════ */}
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
