// Status — two layers (Pato, 2026-08-25).
//
//   GENERAL (7)  bools on the Status box, catalog, Monitor fact chips
//   INTAKE (11)  0–10 in order, each a bool: called or not
//
// Enriched is a yes, not a high-water. Intake just names the eleven
// functions. Create 1–4 / Enrich 1–10 stay Config sequences; they are
// not a third Status ladder. Wire key `seeded` stays; the label is Created.

export const GENERAL_STATUS_FACTS = [
  { key: "seeded", label: "Created" },
  { key: "active", label: "Active" },
  { key: "listed", label: "Listed" },
  { key: "enriched", label: "Enriched" },
  { key: "verified", label: "Verified" },
  { key: "partner", label: "Partner" },
  { key: "promoting", label: "Promoting" },
] as const;

export type GeneralStatusKey = (typeof GENERAL_STATUS_FACTS)[number]["key"];

export const INTAKE_FUNCTIONS = [
  { key: "seed", label: "Seed", n: 0 },
  { key: "pulse", label: "Pulse", n: 1 },
  { key: "details", label: "Details", n: 2 },
  { key: "serp", label: "Serp", n: 3 },
  { key: "links", label: "Links", n: 4 },
  { key: "social", label: "Social", n: 5 },
  { key: "images", label: "Images", n: 6 },
  { key: "menu", label: "Menu", n: 7 },
  { key: "reviews", label: "Reviews", n: 8 },
  { key: "description", label: "Description", n: 9 },
  { key: "semantic", label: "Semantics", n: 10 },
] as const;

export type IntakeFunctionKey = (typeof INTAKE_FUNCTIONS)[number]["key"];

export const GENERAL_STATUS_COUNT = GENERAL_STATUS_FACTS.length;
export const INTAKE_FUNCTION_COUNT = INTAKE_FUNCTIONS.length;
