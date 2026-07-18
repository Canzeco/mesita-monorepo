import type { LucideIcon } from "lucide-react";
import { Gauge, Layers, SlidersHorizontal } from "lucide-react";

// One sidebar entry with TWO tabs (v10, MESITA-644): Subscores defines and
// configures each of the five subscores (EM · SM · GP · RP · XX) — knobs +
// data-access — and carries its own Subscore playground (one consumer ×
// intent × place, internals visible). Scores & Lanes holds how subscores
// combine into a score per lane and how the three lanes merge into the final
// deck — and carries its own Deck playground (full end-to-end run).
//
// The sidebar and the page header both read "Lineup Config" — Lineup is the
// candidate-generation engine (consumer + intent → scored candidates → the
// deck). The route, the scoring_config column and the admin-web-*-scoring-config
// EF names stay "scoring" on purpose: an internal-identifier rename is a
// separate DB + EF migration, not a UI relabel.
//
// Memo is NOT a tab here: it's a product agent (a RAG concierge) that calls
// Lineup as a tool, with its own section at /memo-config.
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Lineup Config",
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
