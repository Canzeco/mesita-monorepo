"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus, FilePen, ListPlus, ListChecks } from "lucide-react";

// Admin sidebar. Single section for now — "Units" — with four actions.
// Sections / items will grow as the admin tooling expands (managers,
// guests, audit logs, etc.).

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const UNIT_NAV: NavItem[] = [
  { href: "/units/create", label: "Manually create unit", Icon: FilePlus },
  { href: "/units/update", label: "Manually update unit", Icon: FilePen },
  { href: "/units/bulk-create", label: "Bulk create units", Icon: ListPlus },
  { href: "/units/bulk-update", label: "Bulk update units", Icon: ListChecks },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-zinc-50 dark:bg-zinc-950 flex h-dvh w-60 shrink-0 flex-col gap-6 border-r border-zinc-200 px-3 py-5 dark:border-zinc-900">
      <Link
        href="/"
        className="flex items-center gap-2 px-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
      >
        <span aria-hidden className="text-lg">
          🌲
        </span>
        Mesita Admin
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="px-2 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase text-zinc-500">
          Units
        </p>
        {UNIT_NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition " +
                (active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
