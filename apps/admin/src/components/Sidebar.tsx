"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FilePlus, FilePen, ListPlus, ListChecks } from "lucide-react";

// Admin sidebar. Single section for now — "Units" — with four actions.
// Sections / items will grow as the admin tooling expands (managers,
// guests, audit logs, etc.). Same Mesita pink-red theme as the manager
// console (semantic tokens from globals.css) — admin uses the brand
// look even though it's an internal surface.

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
    <aside className="border-border bg-card flex h-dvh w-64 shrink-0 flex-col gap-6 border-r px-3 pt-5 pb-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-2"
      >
        <span className="bg-peacock shadow-glow flex h-7 w-7 items-center justify-center rounded-full text-sm">
          🦚
        </span>
        <span className="font-display text-base font-semibold tracking-tight">
          mesita
          <span className="text-primary">.</span>
          <span className="text-muted-foreground ml-1.5 text-[10px] font-medium tracking-[0.16em] uppercase">
            admin
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="text-muted-foreground px-2 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">
          Units
        </p>
        {UNIT_NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition " +
                (active
                  ? "bg-secondary/10 text-secondary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
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
