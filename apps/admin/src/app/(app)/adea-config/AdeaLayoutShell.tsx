"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { AdeaTabNav } from "./AdeaTabNav";
import { ADEA_SUBROUTES } from "./nav";

const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/adea-config/configuration":
    "Tier gates, gather limits, vision, and synthesis quality for the ADEA enrichment pipeline.",
  "/adea-config/calculator":
    "Rough cost and runtime estimate to enrich one new venue with your current settings.",
};

export function AdeaLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = ADEA_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/adea-config/configuration"];

  return (
    <>
      <PageHeader title="ADEA Config" description={description} />
      <AdeaTabNav />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
