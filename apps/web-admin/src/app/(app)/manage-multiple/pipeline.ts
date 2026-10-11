// Multiple Places — five boxes, one per job. Two read, three write.
// The sticky rail and the cards both read from here so a surface cannot
// appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Create, Enrich and Update write, each in its own box over the same Google
// Place IDs (MESITA-2096, Pato: "just use a create box, enrich box, and
// update box. i don't care if kinda redundant"). Create mints the place,
// Enrich fills it, and Update is List, Unlist and Delete — writes to a place
// that already exists. Update is a box, never a button, and there is no
// Create + Enrich combo.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "create", label: "Create" },
  { n: 4, id: "enrich", label: "Enrich" },
  { n: 5, id: "update", label: "Update" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** The five write actions. Create fans out one call per Google Place ID;
 *  Enrich only seeds place_research, and pg_cron claims one row at a time. */
export type CrenupAction = "create" | "delete" | "list" | "unlist" | "enrich";

/** The buttons each write box carries, in order. */
export const WRITE_BOX_ACTIONS = {
  create: ["create"],
  enrich: ["enrich"],
  update: ["list", "unlist", "delete"],
} as const satisfies Partial<Record<PipelineStepId, readonly CrenupAction[]>>;

/** Retired hashes: the one-box era (#crenup), the old Search / Create /
 *  Enrich tabs, and the fourth Edit card. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  crenup: "create",
  "bulk-search": "google-search",
  "bulk-create": "create",
  "bulk-enrich": "enrich",
  "bulk-create-enrich": "create",
  "edit-states": "update",
};
