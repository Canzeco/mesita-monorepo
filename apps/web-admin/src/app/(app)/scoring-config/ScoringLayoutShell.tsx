"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Lineup Config — two tabs (v10): Subscores (the five subscores' knobs +
// data-access, with the Subscore playground) and Scores & Lanes (lane
// composition + the merge into the final deck, with the Deck playground).
//
// "Lineup" is the candidate-generation engine's name; the sidebar, this header
// and the engine label all read Lineup. Only the route and the backend
// scoring_config identifiers stay "scoring" (see nav.ts).
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/subscores":
    "One box per subscore — EM (Embeddings Match), SM (Structured Match), GP (Google Popularity), RP (Rewards Promotions), XX (Random Number) — each with its knobs and its data-access contract, all in [0,1]. The Subscore playground below runs any subscore's internals on one consumer × intent × place.",
  "/scoring-config/lanes":
    "Three lanes, one score each — Organic EM·SM·GP·XX · Inorganic EM·SM·RP·XX · Hybrid EM·SM·GP·RP·XX — merged round-robin O → I → H, dedupe on insert, no backfill (≤ the per-lane counts' sum). The Deck playground below runs the whole pipeline into a final deck.",
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
      <PageHeader title="Lineup Config" description={description} />
      <ConfigTabNav ariaLabel="Lineup Config" subroutes={SCORING_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
