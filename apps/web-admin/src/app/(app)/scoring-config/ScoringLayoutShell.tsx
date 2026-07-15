"use client";

import { ConfigTabsLayout } from "@/components/ConfigTabsLayout";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — four tabs mirroring the model's layers (subscores →
// scores → cards → sub-decks → decks). Subscores = every Subscore's knobs +
// data contract; Cards = every Subscore's internal process on ONE consumer ×
// intent × place (= one CARD); Decks = sub-decks merged into an engine's
// deck; Memo = the concierge's own config (persona/model/retrieval), folded
// in because the Pre-Memo deck feeds it.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/subscores":
    "One box per Subscore — ES (Embeddings Similarity), GP (Google Popularity), RP (Rewards Promotions), IC (Intent Context), CH (Context History — Swipe only, stub) — each with its knobs and its data-access contract: exactly what data computes it.",
  "/scoring-config/cards":
    "One consumer × intent × place = one CARD with four Scores. Every Subscore's internal process — documents, vectors, the popularity curve, the intent context's factors — on exactly that card.",
  "/scoring-config/decks":
    "Swipe · Map · Pre-Memo. Per-lane maxes in → four sub-decks → merged deck, repeats removed (nothing backfills). Per-place scores live in Manage Single Unit → Scores.",
  "/scoring-config/memo":
    "Memo — Mesita's consumer AI concierge (consumer-web-ask-memo). Tune its persona, model, and how it retrieves places. Its retrieval set is the Pre-Memo deck.",
};

export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <ConfigTabsLayout
      title="Scoring Config"
      subroutes={SCORING_SUBROUTES}
      descriptions={SUBPAGE_DESCRIPTION}
    >
      {children}
    </ConfigTabsLayout>
  );
}
