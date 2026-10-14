import { Shapes } from "lucide-react";

// Configurations › Families — the seven Google-search switches, then the
// taxonomy map. Not a Discovery page: profiles, search and the catalog all
// read the same three lists. The switches write discovery_config.
export const FAMILIES_PARENT = {
  href: "/families",
  label: "Families",
  Icon: Shapes,
} as const;
