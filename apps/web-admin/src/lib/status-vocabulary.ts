// Three status categories. The place STATE is Created, not Seeded —
// Seeded is Create Seed, the first Intake Create subfunction.
//
//   GENERAL (7)        Status box · catalog columns · Monitor fact chips
//   INTAKE CREATE (4)  Create box · Create Seed · Pulse · Details · Semantics
//   INTAKE ENRICH (10) Enrich box · Pulse … Description · Semantics
//
// Create Serp is not a create function in shipped code (✨ Intake · pulse-pieces).
// Semantics is Name + Summary, not a queue rung; copy still numbers it 10.

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

export const INTAKE_CREATE_FACTS = [
  { key: "seed", label: "Seed", n: 0 },
  { key: "pulse", label: "Pulse", n: 1 },
  { key: "details", label: "Details", n: 2 },
  { key: "semantics", label: "Semantics", n: 10 },
] as const;

export type IntakeCreateKey = (typeof INTAKE_CREATE_FACTS)[number]["key"];

export const INTAKE_ENRICH_FACTS = [
  { key: "pulse", label: "Pulse", n: 1 },
  { key: "details", label: "Details", n: 2 },
  { key: "serp", label: "Serp", n: 3 },
  { key: "links", label: "Links", n: 4 },
  { key: "social", label: "Social", n: 5 },
  { key: "images", label: "Images", n: 6 },
  { key: "menu", label: "Menu", n: 7 },
  { key: "reviews", label: "Reviews", n: 8 },
  { key: "description", label: "Description", n: 9 },
  { key: "semantics", label: "Semantics", n: 10 },
] as const;

export type IntakeEnrichKey = (typeof INTAKE_ENRICH_FACTS)[number]["key"];

export const GENERAL_STATUS_COUNT = GENERAL_STATUS_FACTS.length;
export const INTAKE_CREATE_COUNT = INTAKE_CREATE_FACTS.length;
export const INTAKE_ENRICH_COUNT = INTAKE_ENRICH_FACTS.length;
