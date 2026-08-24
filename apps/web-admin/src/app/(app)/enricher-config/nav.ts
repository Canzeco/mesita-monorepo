import { Wand2 } from "lucide-react";

// One sidebar entry — "Intake" (Pato, 2026-08-23) — and ONE page, no tabs.
//
// INTAKE is the word for sourcing plus enrichment: sourcing finds the place,
// Create and Enrich take its history. The rail reads General · Sourcing ·
// Intake · Discovery — Sourcing keeps its own row until MESITA-1287 folds it
// in, and then Intake is the single row for both.
//
// THE ROUTE IS FROZEN. A label rename stops at the label: /enricher-config,
// app_config's atlas_* columns and admin-web-*-enricher-config never follow
// one. The ENGINE is still the Intaker (the cron pipeline that builds place
// profiles from the open web; "Atlas" is its legacy brand) — Intake names the
// console, not the machine.
export const INTAKE_PARENT = {
  href: "/enricher-config",
  label: "Intake",
  Icon: Wand2,
} as const;

