"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { AtlasTabNav } from "./AtlasTabNav";
import { ATLAS_SUBROUTES } from "./nav";

// One page, three tabs. The Enricher builds place profiles from the open web; the
// profile spec defines their shape; the calculator prices a run. All three used
// to be split across two sidebar items — now unified here.
const SUBPAGE_DESCRIPTION: Record<string, string> = {
  "/atlas-config/fields":
    "Atlas Params — the controlled vocabulary and field limits the Enricher and operators write place profiles with.",
  "/atlas-config/configuration":
    "Enricher Params — pipeline behaviour: the image funnel (collection → analysis → selection), link discovery, and synthesis models.",
  "/atlas-config/calculator":
    "Enricher Calculator — preview cost and runtime for one enrichment run at the current settings.",
};

export function AtlasLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = ATLAS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  const description =
    (match && SUBPAGE_DESCRIPTION[match.href]) ??
    SUBPAGE_DESCRIPTION["/atlas-config/fields"];

  return (
    <>
      <PageHeader title="Atlas Config" description={description} />
      <AtlasTabNav />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
