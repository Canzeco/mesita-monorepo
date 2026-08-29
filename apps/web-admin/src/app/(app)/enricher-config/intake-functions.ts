// The eleven Intake subfunctions, and which of the two flows uses each.
//
// TWO SEQUENCES — not one global enum. Main §8.4:
//   CREATE (ONE FUNCTION, awaits five): 1 Seed → 2 Pulse → 3 Details
//     → 4 Description → 5 Embedding
//   ENRICH (TEN FUNCTIONS): 1 Pulse → 2 Details → 3 Serp → 4 Links
//     → 5 Social → 6 Images → 7 Menu → 8 Reviews
//     → 9 Description
//     → 10 Embedding
// Chips are short jump labels. Category/Tags/Presentation and Mesita
// Name/Summary/Embeddings live on the Functions accordion blurbs.
// Pulse is 2 on Create and 1 on Enrich. Embedding is 5 on Create and 10
// on Enrich. Seed is Create 1 — never a 0. Chip numbers are derived from
// each flow's order so a shared `chip` string cannot invent a third ladder.
// Engine high-water stays Enrich 1–10 (Created floor 0 is persistence).

export type IntakeFlow = "create" | "enrich";

export type IntakeChip = {
  href: string;
  number: number;
  name: string;
  /** `${n} ${name}` — tests and screen readers */
  label: string;
};

export type IntakeSubfunction = {
  id: string;
  key: string;
  /** Unnumbered 8.4 name. chipsFor prefixes 1…n per flow. */
  name: string;
  flows: readonly IntakeFlow[];
};

export const INTAKE_SUBFUNCTIONS: readonly IntakeSubfunction[] = [
  { id: "f-seed", key: "seed", name: "Seed", flows: ["create"] },
  { id: "f-pulse", key: "pulse", name: "Pulse", flows: ["create", "enrich"] },
  { id: "f-details", key: "details", name: "Details", flows: ["create", "enrich"] },
  { id: "f-serp", key: "serp", name: "Serp", flows: ["enrich"] },
  { id: "f-links", key: "links", name: "Links", flows: ["enrich"] },
  { id: "f-social", key: "social", name: "Social", flows: ["enrich"] },
  { id: "f-images", key: "images", name: "Images", flows: ["enrich"] },
  { id: "f-menu", key: "menu", name: "Menu", flows: ["enrich"] },
  { id: "f-reviews", key: "reviews", name: "Reviews", flows: ["enrich"] },
  {
    id: "f-description",
    key: "description",
    name: "Description",
    flows: ["create", "enrich"],
  },
  {
    id: "f-embedding",
    key: "embedding",
    name: "Embedding",
    flows: ["create", "enrich"],
  },
];

const CREATE_ORDER = [
  "seed",
  "pulse",
  "details",
  "description",
  "embedding",
] as const;

function rowByKey(key: string): IntakeSubfunction {
  const row = INTAKE_SUBFUNCTIONS.find((s) => s.key === key);
  if (!row) throw new Error(`unknown Intake subfunction: ${key}`);
  return row;
}

function numberChips(keys: readonly string[]): IntakeChip[] {
  return keys.map((key, i) => {
    const s = rowByKey(key);
    const number = i + 1;
    return {
      href: `#${s.id}`,
      number,
      name: s.name,
      label: `${number} ${s.name}`,
    };
  });
}

export function chipsFor(flow: IntakeFlow): IntakeChip[] {
  if (flow === "create") return numberChips(CREATE_ORDER);
  return numberChips(
    INTAKE_SUBFUNCTIONS.filter((s) => s.flows.includes("enrich")).map((s) => s.key),
  );
}

export function flowTag(flows: readonly IntakeFlow[]): string {
  if (flows.length === 2) return "Create + Enrich";
  if (flows[0] === "create") return "Create";
  return "Enrich";
}

export function flowTagFor(key: string): string {
  return flowTag(rowByKey(key).flows);
}
