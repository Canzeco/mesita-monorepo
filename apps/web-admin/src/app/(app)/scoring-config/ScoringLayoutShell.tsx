"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Scoring Config — two tabs (v10): Subscores (the five subscores' knobs +
// data-access, with the Subscore playground) and Scores & Lanes (lane
// composition + the merge into the final deck, with the Deck playground).
//
// The header stays "Scoring Config"; only the sidebar entry says "Ranking
// Config" (MESITA-627).
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/scoring-config/subscores":
    "The five subscores — EM · SM · GP · RP · XX — each in [0,1], with its knobs and data-access. The playground runs any subscore's internals on one consumer × intent × place.",
  "/scoring-config/lanes":
    "How the subscores compose — three lanes multiply their subset, then merge O → I → H into the final deck. The playground runs the whole pipeline end to end.",
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
