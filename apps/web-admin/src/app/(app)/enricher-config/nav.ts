import { Wand2 } from "lucide-react";

// One sidebar entry, "Intake" (Pato, MESITA-2159: "Merge Creation and
// Enrichment into Intake"). It undoes the MESITA-2083 split into two rows.
//
// The page is Models (read-only link) · Create · Enrich · Functions. What may
// appear in Search lives on Discovery › Map.
// THE ROUTE PREFIX IS FROZEN: /enricher-config, atlas_* columns,
// admin-web-*-enricher-config. /creation and /enrichment 308 here.
export const INTAKE_PARENT = {
  href: "/enricher-config",
  label: "Intake",
  Icon: Wand2,
} as const;
