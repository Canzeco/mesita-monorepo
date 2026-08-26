// Manage Multiple Places — three boxes. Edit is a control on Mesita Intake,
// not a fourth numbered surface. The sticky rail and the cards both read
// from here so a surface cannot appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Mesita Intake is the make door and the only state write (Listed · Verified ·
// Partner · Promoted) on the same Google Place IDs.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "mesita-intake", label: "Mesita Intake" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** Retired hashes from Search / Create / Enrich and the fourth Edit card. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  "bulk-search": "google-search",
  "bulk-create": "mesita-intake",
  "bulk-enrich": "mesita-intake",
  "bulk-create-enrich": "mesita-intake",
  "edit-states": "mesita-intake",
};
