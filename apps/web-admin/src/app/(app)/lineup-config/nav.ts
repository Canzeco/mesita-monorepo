import type { LucideIcon } from "lucide-react";
import { FlaskConical, Gauge, SlidersHorizontal } from "lucide-react";

// One sidebar entry with TWO tabs (Pato 2026-07-26 — collapsed from four):
//   Config     the whole model on one page — the six subscore boxes
//              (collapsible), the two lane formulas, and deck composition
//   Playground one call (consumer + intent) → the sorted deck
// Old /subscores · /scores · /lanes routes permanently redirect to /config.
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
  { href: "/lineup-config/config", label: "Config", Icon: SlidersHorizontal },
  { href: "/lineup-config/playground", label: "Playground", Icon: FlaskConical },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
