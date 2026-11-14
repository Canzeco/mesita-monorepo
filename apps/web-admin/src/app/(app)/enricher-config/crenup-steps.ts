// The nine Crenup steps, and which of the two flows runs each.
//
// ONE LADDER, TWO FLOWS (Main §8.4 v4, MESITA-2027):
//   0 Seed → 1 Details → 2 Serp → 3 Links → 4 Social
//     → 5 Reviews → 6 Images → 7 Description → 8 Vectors
//   CREATE runs 0, 1, 7, 8.   ENRICH runs 1–8.
//
// THE NUMBER IS THE LADDER'S, NOT THE FLOW'S. This file used to number each
// flow from 1 by position, so `details` was chip 3 on Create and chip 2 on
// Enrich — two answers to "which step is this", and a third ladder beside the
// two in §8.4. Numbers now come from `CRENUP_STEPS`, the shared vocabulary,
// so a reorder there moves these chips and cannot desync.
//
// Chips are short jump labels. On Updation each step is a row of Deep
// Enrich's step list (id f-<key>), which links on to its settings group.
//
// Pulse and Menu were steps until MESITA-2027 and are gone: liveness is a
// subprocess of Details (both always came off one Google Place Details call,
// so the split bought a rung and no information), and the menu is operator
// input the Enricher never derived.

import {
  CRENUP_STEPS,
  crenupFlowTag,
  type CrenupFlow,
} from "@/lib/state-vocabulary";

export type { CrenupFlow };

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

export const CRENUP_STEP_SPECS: readonly CrenupStepSpec[] = CRENUP_STEPS.map(
  (step) => ({
    id: `f-${step.key}`,
    key: step.key,
    name: step.label,
    number: step.n,
    flows: step.flows,
  }),
);

function rowByKey(key: string): CrenupStepSpec {
  const row = CRENUP_STEP_SPECS.find((s) => s.key === key);
  if (!row) throw new Error(`unknown Crenup step: ${key}`);
  return row;
}

function chip(s: CrenupStepSpec, base: string): CrenupChip {
  return {
    href: `${base}#${s.id}`,
    number: s.number,
    name: s.name,
    label: `${s.number} ${s.name}`,
  };
}

/** `base` is the page that holds Functions — empty when it is this page.
 *  Creation's chips point across at Enrichment, where the ladder lives. */
export function chipsFor(flow: CrenupFlow, base = ""): CrenupChip[] {
  return CRENUP_STEP_SPECS.filter((s) => s.flows.includes(flow)).map((s) =>
    chip(s, base),
  );
}

export function flowTag(flows: readonly CrenupFlow[]): string {
  return crenupFlowTag(flows);
}

export function flowTagFor(key: string): string {
  return flowTag(rowByKey(key).flows);
}

// THE UPDATION LEVELS (MESITA-3939): one list the three cards render from,
// cheapest first. What each refreshes is written by hand here and must follow
// the code that writes it:
//   Fast Update  supabase/supabase/functions/_shared/admin-google-place-update.ts
//                (googleBasicsToUpdatePatch)
//   Deep Update  supabase/supabase/functions/_shared/reviews-update.ts
//   Deep Enrich  render/src/enrich.ts (the ladder, steps 1-8)
// When one of those changes what it writes, change its row here.
export type UpdationLevelId = "fast-update" | "deep-update" | "deep-enrich";

export type UpdationLevel = {
  id: UpdationLevelId;
  title: string;
  purpose: string;
  runsOn: "All places" | "No owner";
  cost: string;
  /** Chips. Empty for Deep Enrich, whose steps list says it. */
  refreshes: readonly string[];
  neverTouches?: string;
  keepsEdits?: boolean;
};

export const UPDATION_LEVELS: readonly UpdationLevel[] = [
  {
    id: "fast-update",
    title: "Fast Update",
    purpose: "Google's facts, kept fresh.",
    runsOn: "All places",
    cost: "$ · Google",
    refreshes: [
      "Name on Google",
      "Hours",
      "Phone",
      "Address and location",
      "Price level",
      "Rating and review count",
      "Open or closed",
      "Tags and types",
      "Google's summary",
      "Links Google lists",
    ],
    neverTouches: "photos, the Mesita name, Mesita's text, category or zone",
    keepsEdits: true,
  },
  {
    id: "deep-update",
    title: "Deep Update",
    purpose: "Reviews and followers.",
    runsOn: "All places",
    cost: "$ · Apify",
    refreshes: [
      "Google stars and review count",
      "100 newest Google reviews",
      "Instagram followers",
      "Facebook followers",
    ],
  },
  {
    id: "deep-enrich",
    title: "Deep Enrich",
    purpose: "Everything: research, links, photos and Mesita's own text.",
    runsOn: "No owner",
    cost: "$$ · Apify · Firecrawl · Perplexity",
    refreshes: [],
  },
];

/**
 * The views a level runs at, in words (MESITA-3939). Mirrors the server's
 * triggers in supabase/supabase/functions/_shared/place-requests.ts:
 * viewCycleDue for both Updates; shouldTriggerRequestEnrichment (the first
 * run catches up from N while the place was never enriched) and
 * shouldTriggerRepeatEnrichment for Deep Enrich.
 */
export function viewsLine(level: UpdationLevelId, first: number, every: number): string {
  if (level === "deep-enrich") {
    return every < 1
      ? `Once, from view ${first}`
      : `From view ${first}, then at ${first + every}, ${first + every * 2}…`;
  }
  if (first < 1) return "Off";
  if (every < 1) return `Once, at view ${first}`;
  return `At views ${first}, ${first + every}, ${first + every * 2}…`;
}

/** Where each Deep Enrich step's settings live on Updation, if anywhere. */
export const STEP_SETTINGS: Partial<Record<string, { href: string; label: string }>> = {
  serp: { href: "#k-models", label: "Models and prompts" },
  links: { href: "#k-links", label: "Links" },
  reviews: { href: "#k-reviews", label: "Reviews" },
  images: { href: "#k-images", label: "Images" },
  description: { href: "#k-models", label: "Models and prompts" },
  embedding: { href: "#k-models", label: "Models and prompts" },
};
