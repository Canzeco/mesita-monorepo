import type { LucideIcon } from "lucide-react";
import { FlaskConical, Gauge, Layers, Sigma, SlidersHorizontal } from "lucide-react";

// One sidebar entry with FOUR tabs — the operator's pipeline, in order:
//   Subscores  TUNE        the five subscores' knobs + data access
//   Scores     UNDERSTAND  how the five multiply into the three lane scores
//   Lanes      COMPOSE     per-lane deck counts · the merge · Lineup's callers
//   Playground SIMULATE    both simulators at the CURRENT form values
// One job per page (2026-07-20 restructure; plan: lineup-config-replan).
//
// The sidebar, the page header, the ROUTE (/lineup-config, since 2026-07-20;
// /scoring-config/* permanently redirects) and the EF slugs
// (admin-web-get/update-lineup-config — the old *-scoring-config pair stays
// deployed as a compat alias until old admin builds drain) all read Lineup.
// Only the app_settings.scoring_config COLUMN keeps the old name — renaming
// the singleton's column buys nothing user-visible and is deferred to the
// recommender-*→lineup-* backend batch.
//
// Memo is NOT a tab here: it's a product agent (a RAG concierge) that calls
// Lineup as a tool, with its own section at /memo-config.
export const SCORING_PARENT = {
  href: "/lineup-config",
  label: "Lineup Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/lineup-config/subscores", label: "Subscores", Icon: SlidersHorizontal },
  { href: "/lineup-config/scores", label: "Scores", Icon: Sigma },
  { href: "/lineup-config/lanes", label: "Lanes", Icon: Layers },
  { href: "/lineup-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
