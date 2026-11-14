// Multiple Places — five boxes (MESITA-3942). The sticky rail and the cards
// both read from here so a surface cannot appear on one and vanish from the
// other.
//
// Google Search looks up Google. Mesita Search lists every place on Mesita,
// paged, read-only, and sends the shown IDs on. Mesita Create mints places.
// Mesita Edit holds the five writes on places already on Mesita: Fast Update
// (Google's facts), Deep Update (reviews and followers), Deep Enrich (the
// whole Enricher run, places with no owner only), Enable and Disable. Mesita
// Delete archives (no Undo in this console). Premier is a state filter on
// Mesita Search, not a box: Mesita gives no Upgrade (MESITA-3937).

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "create", label: "Mesita Create" },
  { n: 4, id: "edit", label: "Mesita Edit" },
  { n: 5, id: "delete", label: "Mesita Delete" },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

/** The write actions. Create fans out one call per Google Place ID.
 *  Enrich (labelled Deep Enrich) starts the Render run that is the only
 *  writer of Enriched. */
export type CrenupAction =
  | "create"
  | "delete"
  | "list"
  | "unlist"
  | "enrich"
  | "google-update"
  | "reviews-update";

/** The buttons each write box carries, in order. Delete never sits in Edit. */
export const WRITE_BOX_ACTIONS = {
  create: ["create"],
  edit: ["google-update", "reviews-update", "enrich", "list", "unlist"],
  delete: ["delete"],
} as const satisfies Partial<Record<PipelineStepId, readonly CrenupAction[]>>;

/** Retired hashes land on the box that now holds their job: the one-box era
 *  (#crenup), the old tabs, and the ten-box era's single-action boxes. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  crenup: "create",
  "bulk-search": "google-search",
  "bulk-create": "create",
  "bulk-create-enrich": "create",
  "bulk-enrich": "edit",
  enrich: "edit",
  "google-update": "edit",
  "reviews-update": "edit",
  enable: "edit",
  disable: "edit",
  "edit-states": "edit",
  update: "edit",
  "bulk-update": "edit",
  premier: "mesita-search",
};
