"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { FILTERS_SUBROUTES } from "./nav";
import { SURFACE_META, type SurfaceKey } from "./filters";

// Discovery shell — the header + the tab strip. Mirrors the Promos / Memo /
// Enricher shells; the description switches per active tab so the header always
// says what THIS tab governs.
//
// The page is titled "Discovery", NOT "Discovery Config": a label never repeats
// its section heading, and the section is Configurations (web-admin rules). The
// eyebrow carries the section instead — the same shape Manage › Database uses.

const GENERAL_DESCRIPTION =
  "The law every consumer filter surface inherits: which of the six modules exist, what the sheet opens on, the bounds it may not exceed, and how the store behaves.";

function describe(pathname: string): string {
  const match = FILTERS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  if (!match || match.href === "/filters-config/general") {
    return GENERAL_DESCRIPTION;
  }
  const key = match.href.split("/").pop() as SurfaceKey;
  const meta = SURFACE_META[key];
  return meta ? meta.blurb : GENERAL_DESCRIPTION;
}

export function FiltersLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <PageHeader
        eyebrow="Product · Discovery"
        title="Discovery"
        description={describe(pathname)}
      />
      <ConfigTabNav ariaLabel="Discovery" subroutes={FILTERS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
