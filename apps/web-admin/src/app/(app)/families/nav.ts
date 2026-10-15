import { Map } from "lucide-react";

// Configurations › Atlas — the seven Google-search switches, then the
// taxonomy: FamiliesIA DNA, Google categories, Mesita categories, and every
// tag. Not a Discovery page. The switches write discovery_config.
export const FAMILIES_PARENT = {
  href: "/families",
  label: "Atlas",
  Icon: Map,
} as const;
