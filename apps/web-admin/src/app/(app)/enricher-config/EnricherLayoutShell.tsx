"use client";

import { ConfigTabsLayout } from "@/components/ConfigTabsLayout";
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
  return (
    <ConfigTabsLayout
      title="Enricher Config"
      subroutes={ENRICHER_SUBROUTES}
      descriptions={SUBPAGE_DESCRIPTION}
    >
      {children}
    </ConfigTabsLayout>
  );
}
