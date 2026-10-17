"use client";

import type { ReactNode } from "react";
import { isNavActive } from "@/lib/nav-active";
import { useDiscoveryRoute } from "./discovery-route";
import {
  DISCOVERY_MATRIX_HREF,
  DISCOVERY_MODES_HREF,
  DISCOVERY_SIGNALS_HREF,
  DISCOVERY_TABS,
} from "./nav";

const SOURCES_HREF = DISCOVERY_TABS[0].href;

// All four subpages stay mounted. Switching tabs does not fetch again.
export function DiscoveryPanels({
  sources,
  modes,
  signals,
  matrix,
}: {
  sources: ReactNode;
  modes: ReactNode;
  signals: ReactNode;
  matrix: ReactNode;
}) {
  const pathname = useDiscoveryRoute();
  return (
    <>
      <div hidden={!isNavActive(pathname, SOURCES_HREF)}>{sources}</div>
      <div hidden={!isNavActive(pathname, DISCOVERY_MODES_HREF)}>{modes}</div>
      <div hidden={!isNavActive(pathname, DISCOVERY_SIGNALS_HREF)}>{signals}</div>
      <div hidden={!isNavActive(pathname, DISCOVERY_MATRIX_HREF)}>{matrix}</div>
    </>
  );
}
