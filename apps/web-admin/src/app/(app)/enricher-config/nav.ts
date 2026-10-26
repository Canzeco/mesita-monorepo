import { Layers, MapPinPlus, Pencil, RefreshCw } from "lucide-react";

// Two sidebar entries since MESITA-2083 — "Creation" and "Enrichment" — over
// the one Crenup client (CrenupClient's `view`). Pato: "Models, Creation,
// Enrichment, Discovery, Reservations".
//
// Creation is Models (read-only) · Create; Enrichment is
// Enrich · Functions. What may appear in Search lives on Discovery › Map.
// THE ROUTE PREFIX IS FROZEN: /enricher-config, atlas_* columns,
// admin-web-*-enricher-config. Bare /enricher-config 308s to Creation.
//
// Icons (MESITA-2716): Creation adds a pin to the map, Enrichment stacks
// data onto it. They were a wand and refresh arrows.
export const CREATION_PARENT = {
  href: "/enricher-config/creation",
  label: "Creation",
  Icon: MapPinPlus,
} as const;

export const ENRICHMENT_PARENT = {
  href: "/enricher-config/enrichment",
  label: "Enrichment",
  Icon: Layers,
} as const;

export const UPDATING_PARENT = {
  href: "/enricher-config/updating",
  label: "Updating",
  Icon: RefreshCw,
} as const;

// Editing (MESITA-2796): what an admin's hand edit on Single Place writes.
export const EDITING_PARENT = {
  href: "/enricher-config/editing",
  label: "Editing",
  Icon: Pencil,
} as const;
