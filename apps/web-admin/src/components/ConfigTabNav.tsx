"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type ConfigSubRoute = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

// Shared tab strip for config pages that have subpages (Discovery:
// Discovery Modes · Discovery Sources). One row of underline tabs, one
// per subroute. Matches the tablist styling used across the admin console.
export function ConfigTabNav({
  ariaLabel,
  subroutes,
}: {
  ariaLabel: string;
  subroutes: ReadonlyArray<ConfigSubRoute>;
}) {
  const pathname = usePathname();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="border-border -mx-4 mt-5 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:mt-6 sm:px-0"
    >
      {subroutes.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4 " +
              (active
                ? "border-secondary text-secondary"
                : "text-muted-foreground hover:text-foreground border-transparent")
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
