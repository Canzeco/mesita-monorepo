"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SCORING_SUBROUTES } from "./nav";

// Lineup Config — four tabs, one job each (tune → understand → compose →
// simulate). "Lineup" is the candidate-generation engine's name; the sidebar,
// this header and the engine label all read Lineup. Only the route and the
// backend scoring_config identifiers stay "scoring" (see nav.ts).
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/lineup-config/subscores":
    "Tune the five subscores — every knob is a belief; judge changes by break-even, not spread.",
  "/lineup-config/scores":
    "How the five subscores multiply into the three lane scores — read-mostly; tune on Subscores.",
  "/lineup-config/lanes":
    "Compose the deck: how many cards each lane contributes, how they merge, and who calls Lineup.",
  "/lineup-config/playground":
    "Both simulators, running the CURRENT form values — nothing on this page writes config.",
};

export function ScoringLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = SCORING_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ?? SUBPAGE_DESCRIPTION["/lineup-config/subscores"];

  return (
    <>
      <PageHeader title="Lineup Config" description={description} />
      <ConfigTabNav ariaLabel="Lineup Config" subroutes={SCORING_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
