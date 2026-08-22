import { Compass } from "lucide-react";

// Discovery — ONE sidebar entry, ONE page. The Signals and Engines tabs were
// joined, so there are no subroutes left to publish.
//
// The COMPASS is the domain's mark: it is what Notion Docs › Discovery wears,
// and finding a place is what everything under here is for.
export const FILTERS_PARENT = {
  href: "/filters-config",
  label: "Discovery",
  Icon: Compass,
} as const;
