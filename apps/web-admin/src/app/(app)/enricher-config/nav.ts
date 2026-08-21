import type { LucideIcon } from "lucide-react";
import { Calculator, Radio, Settings2, Wand2 } from "lucide-react";

// One sidebar entry — "Enrichment" (the route stays /enricher-config) — with
// three tabs. The Enricher is the cron pipeline that builds place profiles from
// the open web ("Atlas" is its legacy brand). This page tunes its pipeline
// behaviour and prices a run; the profile spec it writes into lives on the
// separate Atlas Config page.
export const ENRICHER_PARENT = {
  href: "/enricher-config",
  label: "Enrichment",
  Icon: Wand2,
} as const;

export const ENRICHER_SUBROUTES = [
  { href: "/enricher-config/config", label: "Config", Icon: Settings2 },
  { href: "/enricher-config/triggers", label: "Triggers", Icon: Radio },
  { href: "/enricher-config/calculator", label: "Calculator", Icon: Calculator },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
