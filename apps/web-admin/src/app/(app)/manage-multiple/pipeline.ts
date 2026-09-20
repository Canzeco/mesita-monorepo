// Manage Places — three boxes. CRENUP = CReate + ENrich + UPdate, one box
// for all three verbs — not three cards and not a fourth.
// The sticky rail and the cards both read from here so a surface cannot
// appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Crenup is the make door and the only state write on the same Google Place
// IDs. FIVE BUTTONS UNDER THREE VERBS: Create mints the place, Enrich fills
// it, and Update is what List, Unlist and Delete are — writes to a place that
// already exists. Update is never a button of its own (`crenup-batch.test.ts`
// pins that), and there is no Create + Enrich combo.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "crenup", label: "Crenup" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** Retired hashes from Search / Create / Enrich and the fourth Edit card. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  "bulk-search": "google-search",
  "bulk-create": "crenup",
  "bulk-enrich": "crenup",
  "bulk-create-enrich": "crenup",
  "edit-states": "crenup",
};
