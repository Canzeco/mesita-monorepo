import type { LucideIcon } from "lucide-react";
import { Calculator, Settings2, Sparkles } from "lucide-react";

export const ADEA_PARENT = {
  href: "/adea-config",
  label: "ADEA Config",
  Icon: Sparkles,
} as const;

export const ADEA_SUBROUTES = [
  {
    href: "/adea-config/configuration",
    label: "Parameters",
    Icon: Settings2,
  },
  {
    href: "/adea-config/calculator",
    label: "Calculator",
    Icon: Calculator,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

export function isAdeaRoute(pathname: string): boolean {
  return (
    pathname === ADEA_PARENT.href ||
    pathname.startsWith(`${ADEA_PARENT.href}/`)
  );
}
