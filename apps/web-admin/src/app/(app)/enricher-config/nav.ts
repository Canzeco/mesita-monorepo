import { RefreshCw, Wand2 } from "lucide-react";

// Two sidebar entries since MESITA-2083 — "Creation" and "Enrichment" — over
// the one Crenup client (CrenupClient's `view`). Pato: "Models, Creation,
// Enrichment, Discovery, Reservations".
//
// Creation is Models (read-only) · Create · Verification; Enrichment is
// Enrich · Functions. What may appear in Search lives on Discovery › Map.
// THE ROUTE PREFIX IS FROZEN: /enricher-config, atlas_* columns,
// admin-web-*-enricher-config. Bare /enricher-config 308s to Creation.
export const CREATION_PARENT = {
  href: "/enricher-config/creation",
  label: "Creation",
  Icon: Wand2,
} as const;

export const ENRICHMENT_PARENT = {
  href: "/enricher-config/enrichment",
  label: "Enrichment",
  Icon: RefreshCw,
} as const;
