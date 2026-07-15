"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
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

export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = SCORING_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ?? SUBPAGE_DESCRIPTION["/scoring-config/subscores"];

  return (
    <>
      <PageHeader title="Scoring Config" description={description} />
      <ConfigTabNav ariaLabel="Scoring Config" subroutes={SCORING_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
