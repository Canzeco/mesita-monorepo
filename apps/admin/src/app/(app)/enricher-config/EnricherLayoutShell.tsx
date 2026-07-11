"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { ENRICHER_SUBROUTES } from "./nav";

// Enricher Config — two tabs. "Config" tunes pipeline behaviour (the image
// funnel, link discovery, synthesis models); "Calculator" prices one run at the
// current settings.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/enricher-config/config":
    "Pipeline behaviour: the image funnel (collection → analysis → selection), link discovery, and synthesis models.",
  "/enricher-config/calculator":
    "Preview cost and runtime for one enrichment run at the current settings.",
};

export function EnricherLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const match = ENRICHER_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/enricher-config/config"];

  return (
    <>
      <PageHeader title="Enricher Config" description={description} />
      <ConfigTabNav ariaLabel="Enricher Config" subroutes={ENRICHER_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
