"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — four tabs. Pipeline = the model's knobs, one box per
// Sub-Score; Card Sim = every Sub-Score's internal process on ONE consumer ×
// intent × place (= one CARD); Deck Sim = compose an engine's deck from the
// four lanes; Memo = the concierge's own config (persona/model/retrieval),
// folded in because Memo is one of the three scoring engines.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/params":
    "The scoring pipeline, one box per Sub-Score — deck composition, ES (Embeddings Similarity), GP (Google Popularity), RP (Rewards Promotions), WW (where · when) — each with its knobs and its data-access contract.",
  "/scoring-config/card":
    "One consumer × intent × place = one CARD with four Scores. Every Sub-Score's internal process — documents, vectors, the popularity curve, the moment's factors — on exactly that card.",
  "/scoring-config/decks":
    "Compose an engine's deck from the four Lanes — counts in, ordered cards out. Real consumers + real places + synthetic intents. Per-place scores live in Manage Single Unit → Scores.",
  "/scoring-config/memo":
    "Memo — Mesita's consumer AI concierge (consumer-web-ask-memo). Tune its persona, model, and how it retrieves places.",
};

export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = SCORING_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ?? SUBPAGE_DESCRIPTION["/scoring-config/params"];

  return (
    <>
      <PageHeader title="Scoring Config" description={description} />
      <ConfigTabNav ariaLabel="Scoring Config" subroutes={SCORING_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
