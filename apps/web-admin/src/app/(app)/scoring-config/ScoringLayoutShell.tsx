"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — three tabs. Params = the model's hyperparameters;
// Playground = the three engines run over real consumers/places + synthetic
// intents; Memo = the concierge's own config (persona/model/retrieval),
// folded in because Memo is one of the three scoring engines.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/params":
    "The scoring pipeline, one box per sub-function — engine lane mix, RIPM, LIPM, WWW (what · where · when), P — each with its knobs and its data-access contract.",
  "/scoring-config/playground":
    "Real consumers + real places + synthetic intents → the three engines' ranked lists. Per-place scores live in Manage Single Unit → Scores.",
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
