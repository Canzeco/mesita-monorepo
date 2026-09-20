// The nine Crenup steps, and which of the two flows runs each.
//
// ONE LADDER, TWO FLOWS (Main §8.4 v4, MESITA-2027):
//   0 Seed → 1 Details → 2 Serp → 3 Links → 4 Social
//     → 5 Reviews → 6 Images → 7 Description → 8 Embedding
//   CREATE runs 0, 1, 7, 8.   ENRICH runs 1–8.
//
// THE NUMBER IS THE LADDER'S, NOT THE FLOW'S. This file used to number each
// flow from 1 by position, so `details` was chip 3 on Create and chip 2 on
// Enrich — two answers to "which step is this", and a third ladder beside the
// two in §8.4. Numbers now come from `CRENUP_STEPS`, the shared vocabulary,
// so a reorder there moves these chips and cannot desync.
//
// Chips are short jump labels. Category/Tags/Presentation and Mesita
// Name/Summary/Embeddings live on the Functions accordion blurbs.
//
// Pulse and Menu were steps until MESITA-2027 and are gone: liveness is a
// subprocess of Details (both always came off one Google Place Details call,
// so the split bought a rung and no information), and the menu is operator
// input the Enricher never derived.

import { CRENUP_STEPS } from "@/lib/state-vocabulary";

export type CrenupFlow = "create" | "enrich";

export type CrenupChip = {
  href: string;
  number: number;
  name: string;
  /** `${n} ${name}` — tests and screen readers */
  label: string;
};

export type CrenupStepSpec = {
  id: string;
  key: string;
  /** Unnumbered 8.4 name, straight from the shared vocabulary. */
  name: string;
  number: number;
  flows: readonly CrenupFlow[];
};

/** Which flows run a given step. The ladder itself lives in shared/. */
const FLOWS_BY_KEY: Readonly<Record<string, readonly CrenupFlow[]>> = {
  seed: ["create"],
  details: ["create", "enrich"],
  serp: ["enrich"],
  links: ["enrich"],
  social: ["enrich"],
  reviews: ["enrich"],
  images: ["enrich"],
  description: ["create", "enrich"],
  embedding: ["create", "enrich"],
};

export const CRENUP_STEP_SPECS: readonly CrenupStepSpec[] = CRENUP_STEPS.map(
  (step) => {
    const flows = FLOWS_BY_KEY[step.key];
    if (!flows) throw new Error(`Crenup step with no flows: ${step.key}`);
    return {
      id: `f-${step.key}`,
      key: step.key,
      name: step.label,
      number: step.n,
      flows,
    };
  },
);

function rowByKey(key: string): CrenupStepSpec {
  const row = CRENUP_STEP_SPECS.find((s) => s.key === key);
  if (!row) throw new Error(`unknown Crenup step: ${key}`);
  return row;
}

function chip(s: CrenupStepSpec): CrenupChip {
  return {
    href: `#${s.id}`,
    number: s.number,
    name: s.name,
    label: `${s.number} ${s.name}`,
  };
}

export function chipsFor(flow: CrenupFlow): CrenupChip[] {
  return CRENUP_STEP_SPECS.filter((s) => s.flows.includes(flow)).map(chip);
}

export function flowTag(flows: readonly CrenupFlow[]): string {
  if (flows.length === 2) return "Create + Enrich";
  if (flows[0] === "create") return "Create";
  return "Enrich";
}

export function flowTagFor(key: string): string {
  return flowTag(rowByKey(key).flows);
}
