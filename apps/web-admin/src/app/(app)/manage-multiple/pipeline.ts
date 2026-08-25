// The three boxes of Manage Multiple. Search finds Google Place IDs, Create
// mints Mesita places, Enrich re-runs the Intaker. The sticky rail and the
// three cards both read from here so a fourth box cannot appear on one
// surface and vanish from the other.
//
// Create + Enrich is not a box. That combined card was the thing that made
// this page look like two tools stapled together. Search is its own step.

export const PIPELINE_STEPS = [
  { n: 1, id: "bulk-search", label: "Search" },
  { n: 2, id: "bulk-create", label: "Create" },
  { n: 3, id: "bulk-enrich", label: "Enrich" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** Retired combined-box hash from the Create + Enrich layout. */
export const LEGACY_COMBO_HASH = "bulk-create-enrich";
