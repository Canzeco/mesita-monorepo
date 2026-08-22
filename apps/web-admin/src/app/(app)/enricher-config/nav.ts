import { Wand2 } from "lucide-react";

// One sidebar entry — "Enrichment" (the route stays /enricher-config) — and
// ONE page, no tabs (Pato, 2026-08-21). Runs, the config boxes and the
// calculator are all boxes on it. The Enricher is the cron pipeline that builds place profiles from
// the open web ("Atlas" is its legacy brand). This page tunes its pipeline
// behaviour and prices a run; the profile spec it writes into lives on the
// separate Atlas Config page.
export const ENRICHER_PARENT = {
  href: "/enricher-config",
  label: "Enrichment",
  Icon: Wand2,
} as const;

