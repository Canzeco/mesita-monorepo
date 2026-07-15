"use client";

import { ConfigTabsLayout } from "@/components/ConfigTabsLayout";
import { ErrorNote } from "@/components/ErrorNote";
import { useScoring } from "./ScoringProvider";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — three tabs mirroring the model's layers (subscores →
// scores → cards → sub-decks → decks). Subscores = every Subscore's knobs +
// data contract; Cards = every Subscore's internal process on ONE consumer ×
// intent × place (= one CARD); Decks = sub-decks merged into an engine's
// deck. Memo moved back out to /memo-config (MESITA-627) — the Pre-Memo deck
// feeds it, but the concierge's own knobs are not a ranking layer.
//
// The header stays "Scoring Config"; only the sidebar entry says "Ranking
// Config" (MESITA-627).
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/subscores":
    "One box per Subscore — ES (Embeddings Similarity), GP (Google Popularity), RP (Rewards Promotions), IC (Intent Context), CH (Context History — Swipe only, stub) — each with its knobs and its data-access contract: exactly what data computes it.",
  "/scoring-config/cards":
    "One consumer × intent × place = one CARD with four Scores. Every Subscore's internal process — documents, vectors, the popularity curve, the intent context's factors — on exactly that card.",
  "/scoring-config/decks":
    "Swipe · Map · Pre-Memo. Per-lane maxes in → four sub-decks → merged deck, repeats removed (nothing backfills). Per-place scores live in Manage Single Unit → Scores. The Pre-Memo deck is what Memo retrieves over — its own knobs live in Memo Config.",
};

// The layout's two reads seed every tab, so a failure has to be said out loud
// here — defaults are indistinguishable from saved values on the knobs
// themselves. Rendered above the tab body (ConfigTabsLayout owns the header and
// the tab strip, and is shared with the other sections).
export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  const { sampleError, configError } = useScoring();
  return (
    <ConfigTabsLayout
      title="Scoring Config"
      subroutes={SCORING_SUBROUTES}
      descriptions={SUBPAGE_DESCRIPTION}
    >
      {configError && (
        <ErrorNote
          message={`Couldn't load the saved scoring config — ${configError}. Every knob below is showing a code default, not what's live. Save is disabled until a read succeeds.`}
        />
      )}
      {sampleError && (
        <ErrorNote
          message={`Couldn't load the scoring sample — ${sampleError}. The Cards and Decks tabs have no consumers or places to run on.`}
        />
      )}
      {children}
    </ConfigTabsLayout>
  );
}
