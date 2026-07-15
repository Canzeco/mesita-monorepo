import type { LucideIcon } from "lucide-react";
import { Gauge, ListOrdered, MessagesSquare, Microscope, SlidersHorizontal } from "lucide-react";

// One sidebar entry — "Scoring Config" — with four tabs. Pipeline holds the
// model's hyperparameters + configurable data-access contracts; Internals
// walks every score's internal process on ONE consumer × intent × place;
// Engines runs the three engines over the whole sample (ranked lists);
// Memo tunes the concierge (folded in — Memo is one of the three scoring
// engines, so its config lives inside the scoring system).
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Scoring Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/params", label: "Pipeline", Icon: SlidersHorizontal },
  { href: "/scoring-config/internals", label: "Internals", Icon: Microscope },
  { href: "/scoring-config/engines", label: "Engines", Icon: ListOrdered },
  { href: "/scoring-config/memo", label: "Memo", Icon: MessagesSquare },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
