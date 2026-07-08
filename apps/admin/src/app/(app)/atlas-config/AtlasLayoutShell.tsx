"use client";

import { PageHeader } from "@/components/PageContainer";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { ATLAS_SUBROUTES } from "./nav";

// Atlas Config — the profile spec. The controlled vocabulary (categories, tags,
// facets) and field limits the Enricher and operators write place profiles with.
export function AtlasLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader
        title="Atlas Config"
        description="Atlas Params — the controlled vocabulary and field limits the Enricher and operators write place profiles with."
      />
      <ConfigTabNav ariaLabel="Atlas Config" subroutes={ATLAS_SUBROUTES} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
