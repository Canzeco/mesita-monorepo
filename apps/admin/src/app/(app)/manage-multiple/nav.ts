import type { LucideIcon } from "lucide-react";
import { ListChecks, ListFilter, ListPlus } from "lucide-react";

export const MULTIPLE_PARENT = {
  href: "/manage-multiple",
  label: "Manage Multiple Units",
} as const;

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
    href: "/manage-multiple/update",
    label: "Bulk Update",
    Icon: ListChecks,
  },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  Icon: LucideIcon;
}>;

export function isManageMultipleRoute(pathname: string): boolean {
  return (
    pathname === MULTIPLE_PARENT.href ||
    pathname.startsWith(`${MULTIPLE_PARENT.href}/`)
  );
}
