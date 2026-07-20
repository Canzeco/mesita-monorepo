import type { LucideIcon } from "lucide-react";
import { FlaskConical, Gauge, Layers, Sigma, SlidersHorizontal } from "lucide-react";

// One sidebar entry with FOUR tabs — the operator's pipeline, in order:
//   Subscores  TUNE        the five subscores' knobs + data access
//   Scores     UNDERSTAND  how the five multiply into the three lane scores
//   Lanes      COMPOSE     per-lane deck counts · the merge · Lineup's callers
//   Playground SIMULATE    both simulators at the CURRENT form values
// One job per page (2026-07-20 restructure; plan: lineup-config-replan).
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
  { href: "/scoring-config/scores", label: "Scores", Icon: Sigma },
  { href: "/scoring-config/lanes", label: "Lanes", Icon: Layers },
  { href: "/scoring-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
