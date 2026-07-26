import { Sparkles } from "lucide-react";

// One sidebar entry — "Atlas Config" — the profile spec: the controlled
// vocabulary (categories, tags, facets) and the field limits the Enricher and
// operators write place profiles with. A single flat page (no sub-tabs); the
// Enricher's pipeline behaviour lives on the separate Enricher Config page.
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas Config",
  Icon: Sparkles,
} as const;
