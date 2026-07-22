"use client";

// Scores — intentionally empty (Pato 2026-07-22): "leave with soon". The
// per-place draft simulator was retired; the real per-place score readout is a
// later project. The one live, editable per-place score — Manual Priority — is
// on the Place tab; global model knobs live in Lineup Config.
export function ScoresSection() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-muted-foreground text-sm">Soon.</p>
    </div>
  );
}
