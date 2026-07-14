import type { LucideIcon } from "lucide-react";
import { FlaskConical, Gauge, MessagesSquare, SlidersHorizontal } from "lucide-react";

// One sidebar entry — "Scoring Config" — with three tabs. Params holds the
// model's hyperparameters; Playground runs the three engines over real
// consumers/places + synthetic intents; Memo tunes the concierge (folded in
// from the old standalone Memo Config page — Memo is one of the three scoring
// engines, so its config lives inside the scoring system).
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Scoring Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/params", label: "Pipeline", Icon: SlidersHorizontal },
  { href: "/scoring-config/playground", label: "Playground", Icon: FlaskConical },
  { href: "/scoring-config/memo", label: "Memo", Icon: MessagesSquare },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
