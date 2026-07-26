"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { ATLAS_SUBROUTES } from "./nav";

// Atlas Config shell — header + the Config/Playground tab strip. Mirrors the
// Enricher / Lineup config shells; the description switches per active tab.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/atlas-config/config":
    "Atlas Params — who can edit each place field, the controlled vocabulary (categories, tags, facets), and the field limits the Enricher and operators write place profiles with.",
  "/atlas-config/playground":
    "Pick a writer — Native, Enricher, Admin, or Business — and see exactly which place-profile fields it may set.",
};

export function AtlasLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = ATLAS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/atlas-config/config"];

  return (
    <>
      <PageHeader title="Atlas Config" description={description} />
      <ConfigTabNav ariaLabel="Atlas Config" subroutes={ATLAS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
