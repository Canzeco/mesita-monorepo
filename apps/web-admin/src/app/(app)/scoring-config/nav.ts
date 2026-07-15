import type { LucideIcon } from "lucide-react";
import { Gauge, IdCard, Layers, MessagesSquare, SlidersHorizontal } from "lucide-react";

// One sidebar entry — "Scoring Config" — with four tabs. Pipeline holds the
// model's knobs, one box per Sub-Score (deck composition · ES · GP · RP ·
// WW); Card Sim walks every Sub-Score's internal process on ONE consumer ×
// intent × place (= one CARD); Deck Sim composes an engine's deck from the
// four lanes (counts in, ordered cards out); Memo tunes the concierge
// (folded in — Memo is one of the three scoring engines, so its config
// lives inside the scoring system).
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Scoring Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/params", label: "Pipeline", Icon: SlidersHorizontal },
  { href: "/scoring-config/card", label: "Card Sim", Icon: IdCard },
  { href: "/scoring-config/decks", label: "Deck Sim", Icon: Layers },
  { href: "/scoring-config/memo", label: "Memo", Icon: MessagesSquare },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
