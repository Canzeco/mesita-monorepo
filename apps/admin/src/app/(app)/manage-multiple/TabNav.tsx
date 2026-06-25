"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListFilter, ListPlus, ListChecks } from "lucide-react";

const TABS: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { href: "/manage-multiple/search", label: "Search", Icon: ListFilter },
  { href: "/manage-multiple/create", label: "Create", Icon: ListPlus },
  { href: "/manage-multiple/update", label: "Update", Icon: ListChecks },
];

export function ManageMultipleTabs() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Bulk tools"
      className="border-border mt-6 flex gap-1 border-b"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition " +
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
