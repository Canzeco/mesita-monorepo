import { Wand2 } from "lucide-react";

// One sidebar entry — "Intake" — and ONE page, no tabs.
//
// Intake is the Intaker: Models · Create · Enrich · Functions. What may
// appear in Search lives on Discovery › Map. THE ROUTE IS FROZEN:
// /enricher-config, atlas_* columns, admin-web-*-enricher-config.
export const INTAKE_PARENT = {
  href: "/enricher-config",
  label: "Intake",
  Icon: Wand2,
} as const;
