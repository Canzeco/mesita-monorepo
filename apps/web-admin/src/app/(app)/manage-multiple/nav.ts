import type { LucideIcon } from "lucide-react";
import { ListFilter, ListPlus, Sparkles } from "lucide-react";

export const MULTIPLE_SUBROUTES = [
  {
    href: "/manage-multiple/search",
    label: "Bulk Search",
    Icon: ListFilter,
  },
  {
    href: "/manage-multiple/create",
    label: "Bulk Create",
    Icon: ListPlus,
  },
  {
    // "Bulk Enrich", not "Bulk Update" (Pato 2026-08-03). Enrichment is what
    // this tab is for — running the Enricher over many places at once, the
    // bulk twin of the per-place Re-enrich button. The old placeholder copy
    // described CSV field overwrites, which is a different feature; it was
    // never built, so the name and the intent were realigned together.
    href: "/manage-multiple/enrich",
    label: "Bulk Enrich",
    Icon: Sparkles,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;
