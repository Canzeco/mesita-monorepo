// The three boxes of Manage Multiple. Create mints from Google Place IDs
// (search lives inside that box). Enrich re-runs the Intaker on Mesita IDs.
// Create + Enrich is mint then the same Enrich run, in one box. The sticky
// rail and the three cards both read from here so a fourth box cannot appear
// on one surface and vanish from the other.

export const PIPELINE_STEPS = [
  { n: 1, id: "bulk-create", label: "Create" },
  { n: 2, id: "bulk-enrich", label: "Enrich" },
  { n: 3, id: "bulk-create-enrich", label: "Create + Enrich" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** Retired Search-step hash. The queries UI now sits inside Create. */
export const LEGACY_SEARCH_HASH = "bulk-search";
