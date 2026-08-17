import { Filter } from "lucide-react";

// One sidebar entry — "Sourcing Config". A single flat page (the Playground
// was retired 2026-08-01, same call as Atlas/Reservations Config). Governs
// which Google places are eligible to enter Mesita, per sourcing channel.
export const SOURCING_PARENT = {
  href: "/sourcing-config",
  label: "Sourcing",
  Icon: Filter,
} as const;
