import type { LucideIcon } from "lucide-react";
import { Gauge, IdCard, Layers, MessagesSquare, SlidersHorizontal } from "lucide-react";

// One sidebar entry — "Scoring Config" — with four tabs mirroring the model's
// layers (subscores → scores → cards → sub-decks → decks). Subscores holds
// every Subscore's knobs + data-access contract (what data computes it);
// Cards walks every Subscore's internal process on ONE consumer × intent ×
// place (= one CARD with its four Scores); Decks composes an engine's deck —
// per-lane maxes in, sub-decks merged, ordered cards out; Memo tunes the
// concierge (folded in — the Pre-Memo deck feeds it).
export const SCORING_PARENT = {
  href: "/scoring-config",
  label: "Scoring Config",
  Icon: Gauge,
} as const;

export const SCORING_SUBROUTES = [
  { href: "/scoring-config/subscores", label: "Subscores", Icon: SlidersHorizontal },
  { href: "/scoring-config/cards", label: "Cards", Icon: IdCard },
  { href: "/scoring-config/decks", label: "Decks", Icon: Layers },
  { href: "/scoring-config/memo", label: "Memo", Icon: MessagesSquare },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
