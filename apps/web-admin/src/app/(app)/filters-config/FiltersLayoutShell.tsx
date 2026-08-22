"use client";

import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { FILTERS_SUBROUTES } from "./nav";

// Discovery shell — the page title and the two tabs, and nothing else.
//
// The per-tab description line is deliberately gone: both pages are empty
// until the rebuild lands, and a header explaining what a blank page WILL
// hold is just prose on a page that is supposed to be bare.

export function FiltersLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow="Product · Discovery" title="Discovery" />
      <ConfigTabNav ariaLabel="Discovery" subroutes={FILTERS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
