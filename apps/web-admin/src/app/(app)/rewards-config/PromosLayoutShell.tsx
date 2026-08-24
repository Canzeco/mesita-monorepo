"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PROMOS_SUBROUTES } from "./nav";

// Promos Config shell — header + Tiers / Distribution tabs. Description is
// one line; stacking math lives behind a disclosure on Tiers.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/rewards-config/tiers":
    "Components that build every rate. A place picks one strategy — its column is the whole program.",
  "/rewards-config/distribution":
    "Expected spread across 1,000 visits on the saved config. Save Tiers first.",
};

export function PromosLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = PROMOS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/rewards-config/tiers"];

  return (
    <>
      <PageHeader
        eyebrow="Product · Promos"
        title="Promos Config"
        description={description}
      />
      <ConfigTabNav ariaLabel="Promos Config" subroutes={PROMOS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
