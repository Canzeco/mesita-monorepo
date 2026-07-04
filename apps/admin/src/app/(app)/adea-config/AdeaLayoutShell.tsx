"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { AdeaTabNav } from "./AdeaTabNav";
import { ADEA_SUBROUTES } from "./nav";

const ADEA_WHAT =
  "The Enricher builds place profiles from the open web. When a place is created, it runs every pipeline step S0→S9 — Google spine, link discovery, source harvest, image perception, and synthesis — then persists the listing.";

const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/adea-config/configuration":
    `${ADEA_WHAT} Parameters control gather limits, vision, and synthesis quality.`,
  "/adea-config/calculator":
    `${ADEA_WHAT} Calculator previews cost and runtime for one enrichment run at your current settings.`,
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
      <PageHeader title="Enricher Config" description={description} />
      <AdeaTabNav />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
