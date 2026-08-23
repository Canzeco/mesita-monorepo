// The three re-enrich modes, named ONCE.
//
// Two surfaces queue the identical pipeline — the Enrichment box on a single
// place, and the Enrich step in Manage Multiple Places — and they used to name
// its modes differently: "Images" here, "Analysis + contents" there. Same
// button, same Edge Function, two vocabularies, so an operator had to learn
// which screen they were on before they could predict what a run would redo.
//
// The labels are what the mode REDOES, not which stage function it enters:
// `analysis` re-ranks images, `contents` rewrites the Presentation. The
// stage names stay in the wire contract, where they belong.
//
// This cannot live in actions.ts — that module is "use server", and a
// "use server" file may only export async functions. The TYPE still comes from
// there (types are erased, so a type-only import is free).
import type { ReenrichMode } from "./actions";

export const REENRICH_MODES: {
  value: ReenrichMode;
  label: string;
  hint: string;
  /** Light modes reuse a payload an earlier full run stored. Missing it is a
   *  422 from admin-web-enrich-place, so the operator runs a full pass first
   *  rather than silently getting one. */
  needsPriorRun: boolean;
}[] = [
  {
    value: "full",
    label: "Full",
    hint:
      "Re-gathers everything: Google, channels, reviews, photos, then rewrites the Presentation. The only mode that refreshes facts.",
    needsPriorRun: false,
  },
  {
    value: "analysis",
    label: "Images",
    hint:
      "Re-ranks and re-picks photos from what the last full run gathered. No new web calls.",
    needsPriorRun: true,
  },
  {
    value: "contents",
    label: "Description",
    hint:
      "Re-writes the Presentation, category and tags from stored research. Cheapest.",
    needsPriorRun: true,
  },
];
