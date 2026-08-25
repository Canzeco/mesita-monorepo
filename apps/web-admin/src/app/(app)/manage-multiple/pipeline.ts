// The three steps of Manage Multiple. Search finds Google Place IDs, Create
// mints Mesita places, Enrich re-runs the Intaker. The page is this list —
// a sticky rail and the three cards both read from here so a fourth step
// cannot appear on one surface and vanish from the other.

export const PIPELINE_STEPS = [
  { n: 1, id: "bulk-search", label: "Search" },
  { n: 2, id: "bulk-create", label: "Create" },
  { n: 3, id: "bulk-enrich", label: "Enrich" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];
