import { Filter } from "lucide-react";

// One sidebar entry — "Sourcing Config". Governs which Google places are eligible
// to enter Mesita, per sourcing channel. A single flat page, no sub-tabs.
export const SOURCING_PARENT = {
  href: "/sourcing-config",
  label: "Sourcing Config",
  Icon: Filter,
} as const;
