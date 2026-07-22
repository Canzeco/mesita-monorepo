"use client";

import { ScoresSection } from "../../sections/ScoresSection";

// Per-place Scores — a placeholder for now (the draft simulator was retired).
// The live editable per-place score, Manual Priority, is on the Place tab.
export default function UnitScoresPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <ScoresSection />
    </div>
  );
}
