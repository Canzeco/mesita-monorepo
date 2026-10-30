// Multiple Places — six boxes, one per job. Two read, four write.
// The sticky rail and the cards both read from here so a surface cannot
// appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Create, Enrich and Edit write, each in its own box over the same Google
// Place IDs (MESITA-2096, Pato: "just use a create box, enrich box, and
// update box. i don't care if kinda redundant"). Create mints the place,
// Enrich fills it, and that run is the only way a place becomes Enriched.
// Edit writes a place that already exists: Enable and Disable toggle guest
// visibility, Premier 2X · Premier 5X · End Premier set its Manual Premier for
// N months (MESITA-3090/3091; refused, unchanged, only for an archived place;
// what a guest pays is never touched), and Delete
// archives (Select and Unselect died with Selected, MESITA-2925). Edit is a box, never a button, and there is no Create +
// Enrich combo. Edit does not sync.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "create", label: "Create" },
  { n: 4, id: "enrich", label: "Enrich" },
  { n: 5, id: "google-update", label: "Update" },
  { n: 6, id: "edit", label: "Edit" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** The write actions. Create fans out one call per Google Place ID.
 *  Enrich starts the Render run that is the only writer of Enriched. */
export type CrenupAction =
  | "create"
  | "delete"
  | "list"
  | "unlist"
  | "enrich"
  | "google-update"
  | "premier-2x"
  | "premier-5x"
  | "premier-off";

/** The buttons each write box carries, in order. */
export const WRITE_BOX_ACTIONS = {
  create: ["create"],
  enrich: ["enrich"],
  "google-update": ["google-update"],
  edit: ["list", "unlist", "premier-2x", "premier-5x", "premier-off", "delete"],
} as const satisfies Partial<Record<PipelineStepId, readonly CrenupAction[]>>;

/** Retired hashes: the one-box era (#crenup), the old Search / Create /
 *  Enrich tabs, and the fourth Edit card. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  crenup: "create",
  "bulk-search": "google-search",
  "bulk-create": "create",
  "bulk-enrich": "enrich",
  "bulk-create-enrich": "create",
  "edit-states": "edit",
  update: "google-update",
  "bulk-update": "google-update",
};
