"use client";

import { usePathname } from "next/navigation";
import { ErrorNote } from "@/components/ErrorNote";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";
import { useScoring } from "./ScoringProvider";

// Lineup Config — two tabs (Config · Playground). "Lineup" is the
// candidate-generation engine's name; the sidebar, this header and the engine
// label all read Lineup. Only the route and the backend scoring_config
// identifiers stay "scoring" (see nav.ts).
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/lineup-config/config":
    "The whole model on one page — tune the six subscores, read the two lane formulas, compose the deck.",
  "/lineup-config/playground":
    "One Lineup call — consumer + intent in, the sorted deck out; nothing on this page writes config.",
};

export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loadError } = useScoring();
  const match = SCORING_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ?? SUBPAGE_DESCRIPTION["/lineup-config/config"];

  return (
    <>
      <PageHeader title="Lineup Config" description={description} />
      <ConfigTabNav ariaLabel="Lineup Config" subroutes={SCORING_SUBROUTES} />
      {loadError ? (
        <div className="mt-4">
          <ErrorNote message={loadError} />
        </div>
      ) : null}
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
