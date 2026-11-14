// Multiple Places — one box per job. Two read, eight write.
// The sticky rail and the cards both read from here so a surface cannot
// appear on one and vanish from the other.
//
// Google Search looks up Google. Mesita Search looks up Mesita (read-only).
// Create mints the place; Enrich fills it, and that run is the only way a
// place becomes Enriched. Then the special actions, one box each (Pato,
// MESITA-3159: "Enrich, Update Google, Update Reviews, Enable, Disable… edit
// is too vague"): Update Google refreshes Google's facts; Update Reviews
// refreshes Google stars, the Apify review list and the Instagram and
// Facebook followers; Enable and Disable toggle guest visibility; Delete
// archives (kept, gate answer 2026-11-02). The Edit box and its Manual
// Premier buttons are gone (MESITA-3159; staff Premier left Business in
// MESITA-3146). There is no Create + Enrich combo. Upgrade (was Refill, MESITA-3163) is
// box 5, right after Enrich (MESITA-3188, Pato: "enrich, boost, update, update"):
// Premier 2X or 5X for N days, or ends Mesita's; it also lists who is Premier now.

export const PIPELINE_STEPS = [
  { n: 1, id: "google-search", label: "Google Search" },
  { n: 2, id: "mesita-search", label: "Mesita Search" },
  { n: 3, id: "create", label: "Create" },
  { n: 4, id: "enrich", label: "Enrich" },
  { n: 5, id: "refill", label: "Upgrade" },
  { n: 6, id: "google-update", label: "Fast Update" },
  { n: 7, id: "reviews-update", label: "Deep Update" },
  { n: 8, id: "enable", label: "Enable" },
  { n: 9, id: "disable", label: "Disable" },
  { n: 10, id: "delete", label: "Delete" },
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
  | "reviews-update";

/** The buttons each write box carries, in order. */
export const WRITE_BOX_ACTIONS = {
  create: ["create"],
  enrich: ["enrich"],
  "google-update": ["google-update"],
  "reviews-update": ["reviews-update"],
  enable: ["list"],
  disable: ["unlist"],
  delete: ["delete"],
} as const satisfies Partial<Record<PipelineStepId, readonly CrenupAction[]>>;

/** Retired hashes: the one-box era (#crenup), the old Search / Create /
 *  Enrich tabs, and the fourth Edit card. */
export const LEGACY_HASHES: Record<string, PipelineStepId> = {
  crenup: "create",
  "bulk-search": "google-search",
  "bulk-create": "create",
  "bulk-enrich": "enrich",
  "bulk-create-enrich": "create",
  "edit-states": "enable",
  edit: "enable",
  update: "google-update",
  "bulk-update": "google-update",
};
