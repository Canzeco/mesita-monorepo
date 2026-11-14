import { StackIcon, MapPinPlusIcon } from "@phosphor-icons/react/dist/ssr";

// Two sidebar entries since MESITA-2083 — "Creating" and "Enriching" (were
// Creation and Enrichment until MESITA-2800, one -ing verb per row) — over
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
  label: "Creating",
  Icon: MapPinPlusIcon,
} as const;

// Uprich (MESITA-3924, Pato: "create a page called Uprich ... include both
// the admin configuration of Update and Enrich"): one page for Enrich,
// Functions and Update, one Save. The buttons keep the verbs Enrich and
// Update; the two backends stay separate (MESITA-3844). /enricher-config/
// enrichment and /updating 308 here.
export const UPRICH_PARENT = {
  href: "/enricher-config/uprich",
  label: "Uprich",
  Icon: StackIcon,
} as const;

// Editing (MESITA-2796) is gone (MESITA-3162, Pato: "there is no editing
// anymore"); /enricher-config/editing falls to [...slug] and lands on Creation.
