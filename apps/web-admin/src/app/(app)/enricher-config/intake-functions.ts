// The eleven Intake subfunctions, and which of the two flows uses each.
//
// Create is ONE function that AWAITS four subfunctions (Seed, Pulse, Details,
// Semantic). Enrich is TEN functions on sequential ticks — none await a nested
// run. Shared rows print once on the page. This file is the chip + tag source
// so Create, Enrich, Status and the ladder cannot drift.

export type IntakeFlow = "create" | "enrich";

export type IntakeSubfunction = {
  id: string;
  key: string;
  chip: string;
  flows: readonly IntakeFlow[];
};

export const INTAKE_SUBFUNCTIONS: readonly IntakeSubfunction[] = [
  { id: "f-seed", key: "seed", chip: "Seed", flows: ["create"] },
  { id: "f-pulse", key: "pulse", chip: "1 Pulse", flows: ["create", "enrich"] },
  { id: "f-details", key: "details", chip: "2 Details", flows: ["create", "enrich"] },
  { id: "f-serp", key: "serp", chip: "3 Serp", flows: ["enrich"] },
  { id: "f-links", key: "links", chip: "4 Links", flows: ["enrich"] },
  { id: "f-social", key: "social", chip: "5 Social", flows: ["enrich"] },
  { id: "f-images", key: "images", chip: "6 Images", flows: ["enrich"] },
  { id: "f-menu", key: "menu", chip: "7 Menu", flows: ["enrich"] },
  { id: "f-reviews", key: "reviews", chip: "8 Reviews", flows: ["enrich"] },
  { id: "f-description", key: "description", chip: "9 Description", flows: ["enrich"] },
  {
    id: "f-semantic",
    key: "semantic",
    chip: "◇ Semantic",
    flows: ["create", "enrich"],
  },
];

export function chipsFor(flow: IntakeFlow): { href: string; label: string }[] {
  return INTAKE_SUBFUNCTIONS.filter((s) => s.flows.includes(flow)).map((s) => ({
    href: `#${s.id}`,
    label: s.chip,
  }));
}

export function flowTag(flows: readonly IntakeFlow[]): string {
  if (flows.length === 2) return "Create + Enrich";
  if (flows[0] === "create") return "Create";
  return "Enrich";
}

export function flowTagFor(key: string): string {
  const row = INTAKE_SUBFUNCTIONS.find((s) => s.key === key);
  if (!row) throw new Error(`unknown Intake subfunction: ${key}`);
  return flowTag(row.flows);
}
