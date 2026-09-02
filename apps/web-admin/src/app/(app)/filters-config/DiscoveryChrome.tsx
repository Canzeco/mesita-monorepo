"use client";

import { usePathname } from "next/navigation";
import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PageHeader } from "@/components/PageContainer";
import { DISCOVERY_TABS } from "./nav";

// Title follows the active subpage: Discovery Modes · Discovery Sources.
export function DiscoveryChrome() {
  const pathname = usePathname();
  const tab = DISCOVERY_TABS.find(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`),
  );
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
