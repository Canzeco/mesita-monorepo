"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { FILTERS_SUBROUTES } from "./nav";

// Discovery shell — the header + the tab strip. Mirrors the Promos / Memo /
// Enricher shells; the description switches per active tab so the header always
// says what THIS tab governs.
//
// The page is titled "Discovery", NOT "Discovery Config": a label never repeats
// its section heading, and the section is Configurations (web-admin rules). The
// eyebrow carries the section instead — the same shape Manage › Database uses.

// One line each. Two pages, two sentences — the surface-by-surface prose that
// used to live here went with the seven tabs.
const DESCRIPTIONS: Record<string, string> = {
  "/filters-config/signals":
    "The six things a guest can ask for, and the law every engine inherits.",
  "/filters-config/engines":
    "The surfaces that answer with places.",
};

function describe(pathname: string): string {
  const match = FILTERS_SUBROUTES.find(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
  return DESCRIPTIONS[match?.href ?? ""] ?? DESCRIPTIONS["/filters-config/signals"];
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
