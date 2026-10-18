"use client";

import type { ReactNode } from "react";
import { isNavActive } from "@/lib/nav-active";
import { useDiscoveryRoute } from "./discovery-route";
import { DISCOVERY_MODES_HREF, DISCOVERY_SIGNALS_HREF } from "./nav";

// Both subpages stay mounted. Switching tabs does not fetch again.
export function DiscoveryPanels({
  modes,
  signals,
}: {
  modes: ReactNode;
  signals: ReactNode;
}) {
  const pathname = useDiscoveryRoute();
  return (
    <>
      <div hidden={!isNavActive(pathname, DISCOVERY_MODES_HREF)}>{modes}</div>
      <div hidden={!isNavActive(pathname, DISCOVERY_SIGNALS_HREF)}>{signals}</div>
    </>
  );
}
