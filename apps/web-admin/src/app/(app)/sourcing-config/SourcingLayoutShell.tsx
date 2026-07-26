"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { SOURCING_SUBROUTES } from "./nav";

// Sourcing Config shell — header + the Config/Playground tab strip. Mirrors the
// Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/sourcing-config/config":
    "Which places are allowed into Mesita, who can see them, and who can add them. Per actor there are two filters: search (what's visible in the searchbar — including Google places not yet in Mesita) and add (what may actually be onboarded). Each picks the eligible place families and a Google quality bar (min rating + reviews).",
  "/sourcing-config/playground":
    "Enter a candidate place's Google rating, review count, and family, and see which sourcing channels would admit it — and which reject it, and why.",
};

export function SourcingLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = SOURCING_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/sourcing-config/config"];

  return (
    <>
      <PageHeader
        eyebrow="Operations · Sourcing"
        title="Sourcing Config"
        description={description}
      />
      <ConfigTabNav ariaLabel="Sourcing Config" subroutes={SOURCING_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
