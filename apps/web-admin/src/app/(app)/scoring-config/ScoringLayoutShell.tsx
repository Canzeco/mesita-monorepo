"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — four tabs. Pipeline = the model's hyperparameters +
// configurable data-access contracts; Internals = every score's internal
// process on ONE consumer × intent × place; Engines = the three engines
// ranking the whole sample; Memo = the concierge's own config
// (persona/model/retrieval), folded in because Memo is one of the three
// scoring engines.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/params":
    "The scoring pipeline, one box per Sub-Score — engine lane mix, FM (Fast-Match), SM (Slow-Match), WWW (what · where · when), BP (Business Promo) — each with its knobs and its data-access contract.",
  "/scoring-config/internals":
    "The internal process of every Sub-Score — documents, vectors, the judge's verdict, the moment's factors — on exactly ONE consumer × intent × place.",
  "/scoring-config/engines":
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
