"use client";

import { Gauge } from "lucide-react";
import { SectionCard } from "../ui";

// Scores — placeholder (Pato 2026-07-22): compute nothing, display nothing.
// The per-place draft simulator was retired; the real per-place score readout
// is a later project. The one live, editable per-place score — Manual Priority
// (MP subscore) — lives on the Place tab. Global model knobs live in Lineup
// Config.
export function ScoresSection() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <SectionCard
        icon={<Gauge className="h-4.5 w-4.5" />}
        tint="slate"
        title="Scores"
        subtitle="A per-place score readout is coming here. For now, set this place's Manual Priority on the Place tab, and tune the global Lineup model in Lineup Config."
      >
        <div className="text-muted-foreground border-border/60 mt-2 flex items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-sm">
          Coming soon.
        </div>
      </SectionCard>
    </div>
  );
}
