import { Wand2 } from "lucide-react";

// One sidebar entry — "Crenup" — and ONE page, no tabs.
//
// Crenup is the Enricher: Models · Create · Enrich · Functions. What may
// appear in Search lives on Discovery › Map. THE ROUTE IS FROZEN:
// /enricher-config, atlas_* columns, admin-web-*-enricher-config.
export const CRENUP_PARENT = {
  href: "/enricher-config",
  label: "Crenup",
  Icon: Wand2,
} as const;
