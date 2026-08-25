// Manage Multiple Places — three boxes plus one Edit control at the bottom.
// The sticky rail and the cards both read from here so a surface cannot
// appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Mesita Intake is the make door. Edit is the only state write on this page.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "mesita-intake", label: "Mesita Intake" },
  { n: 4, id: "edit-states", label: "Edit" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** Retired hashes from Search / Create / Enrich and the combined-box layout. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  "bulk-search": "google-search",
  "bulk-create": "mesita-intake",
  "bulk-enrich": "mesita-intake",
  "bulk-create-enrich": "mesita-intake",
};
