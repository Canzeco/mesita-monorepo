import type { LucideIcon } from "lucide-react";
import { Gauge, Layers, SlidersHorizontal } from "lucide-react";

// One sidebar entry with TWO tabs (v10, MESITA-644): Subscores defines and
// configures each of the five subscores (EM · SM · GP · RP · XX) — knobs +
// data-access — and carries its own Subscore playground (one consumer ×
// intent × place, internals visible). Scores & Lanes holds how subscores
// combine into a score per lane and how the three lanes merge into the final
// deck — and carries its own Deck playground (full end-to-end run).
//
// The sidebar reads "Ranking Config" (MESITA-627) while the route, the page
// header, and every scoring_config / admin-web-*-scoring-config name stay
// "scoring" — the rename was scoped to the menu label on purpose.
//
// Memo is NOT a tab here (MESITA-627): it's a product agent with its own
// section at /memo-config.
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Ranking Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/subscores", label: "Subscores", Icon: SlidersHorizontal },
  { href: "/scoring-config/lanes", label: "Scores & Lanes", Icon: Layers },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
