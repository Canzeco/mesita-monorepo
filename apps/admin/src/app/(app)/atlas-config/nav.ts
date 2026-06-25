import type { LucideIcon } from "lucide-react";
import { Calculator, ListTree, SlidersHorizontal } from "lucide-react";

export const ATLAS_ROUTES = [
  {
    href: "/atlas-config/configuration",
    label: "ADEA Config",
    Icon: SlidersHorizontal,
  },
  {
    href: "/atlas-config/calculator",
    label: "ADEA Calculator",
    Icon: Calculator,
  },
  {
    href: "/atlas-config/fields",
    label: "Atlas fields",
    Icon: ListTree,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

export function isAtlasRoute(pathname: string): boolean {
  return ATLAS_ROUTES.some(
    (r) => pathname === r.href || pathname.startsWith(`${r.href}/`),
  );
}
