"use client";

import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PageHeader } from "@/components/PageContainer";
import { isNavActive } from "@/lib/nav-active";
import { useDiscoveryPathname } from "./discovery-route";
import { DISCOVERY_TABS } from "./nav";

// Title follows the active subpage: Sources · Modes · Signals · Matrix.
export function DiscoveryChrome() {
  const pathname = useDiscoveryPathname();
  const tab = DISCOVERY_TABS.find((t) => isNavActive(pathname, t.href));
  return (
    <>
      <PageHeader
        eyebrow="Product · Discovery"
        title={tab?.label ?? "Discovery"}
      />
      <ConfigTabNav ariaLabel="Discovery sections" subroutes={DISCOVERY_TABS} />
    </>
  );
}
