import type { LucideIcon } from "lucide-react";
import { Gauge, IdCard, Layers, SlidersHorizontal } from "lucide-react";

// One sidebar entry with three tabs mirroring the model's layers (subscores →
// scores → cards → sub-decks → decks). Subscores holds every Subscore's knobs
// + data-access contract (what data computes it); Cards walks every Subscore's
// internal process on ONE consumer × intent × place (= one CARD with its four
// Scores); Decks composes an engine's deck — per-lane maxes in, sub-decks
// merged, ordered cards out.
//
// The sidebar reads "Ranking Config" (MESITA-627) while the route, the page
// header, and every scoring_config / admin-web-*-scoring-config name stay
// "scoring" — the rename was scoped to the menu label on purpose.
//
// Memo is NOT a tab here (MESITA-627): it's a product agent with its own
// section at /memo-config. The Pre-Memo deck composed on the Decks tab is its
// retrieval input, which is the whole relationship.
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Ranking Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/subscores", label: "Subscores", Icon: SlidersHorizontal },
  { href: "/scoring-config/cards", label: "Cards", Icon: IdCard },
  { href: "/scoring-config/decks", label: "Decks", Icon: Layers },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
