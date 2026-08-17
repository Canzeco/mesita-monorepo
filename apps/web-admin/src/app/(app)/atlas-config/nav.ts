import { Sparkles } from "lucide-react";

// One sidebar entry — "Atlas Config". A single flat page (the Playground was
// retired 2026-08-01, same call as Sourcing/Reservations Config — the "who
// can edit" matrix already lives on this page, a per-writer filter of it
// added nothing). The profile spec: the controlled vocabulary (categories,
// tags, facets) and the field limits the Enricher and operators write place
// profiles with.
export const ATLAS_PARENT = {
  href: "/atlas-config",
  label: "Atlas",
  Icon: Sparkles,
} as const;
