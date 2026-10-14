import { Shapes } from "lucide-react";

// Manage › Families — the taxonomy, read-only. Not a Discovery page:
// profiles, search and the catalog all read the same three lists.
export const FAMILIES_PARENT = {
  href: "/families",
  label: "Families",
  Icon: Shapes,
} as const;
