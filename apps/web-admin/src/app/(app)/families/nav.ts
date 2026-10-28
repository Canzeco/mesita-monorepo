import { Map } from "lucide-react";

// Configurations › Atlas — the Mesita Families, Google's categories split
// into enabled and not enabled on Mesita, and every tag (MESITA-2891). Not a
// Discovery page.
export const FAMILIES_PARENT = {
  href: "/families",
  label: "Atlas",
  Icon: Map,
} as const;
