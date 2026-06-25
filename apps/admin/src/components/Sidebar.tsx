"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Compass,
  FilePen,
  Layers,
  LogOut,
} from "lucide-react";
import { authSignOut } from "@/app/auth/actions";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

type SidebarProps = {
  email: string | null;
  onNavigate?: () => void;
};

// The console is deliberately five items. Single-unit and multi-unit
// management are split (the latter consolidates the bulk search/create/
// update tools behind one tabbed surface at /bulk). Routes that still
// exist but aren't part of the day-to-day surface (e.g. /verifications,
// /central, /create) are reachable directly but stay off the nav.
const NAV: NavItem[] = [
  { href: "/atlas", label: "Atlas Configuration", Icon: Compass },
  { href: "/update", label: "Manage Single Unit", Icon: FilePen },
  { href: "/bulk", label: "Manage Multiple Units", Icon: Layers },
  { href: "/performance", label: "Global Performance", Icon: BarChart3 },
  { href: "/danger", label: "Danger Zone", Icon: AlertTriangle },
];

export function Sidebar({ email, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-card flex h-full w-64 shrink-0 flex-col gap-6 overflow-hidden border-r px-3 pt-5 pb-4">
      <Link
        href="/central"
        onClick={onNavigate}
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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
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

      {email && (
        <form action={authSignOut}>
          <button
            type="submit"
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition"
            title="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">{email}</span>
          </button>
        </form>
      )}
    </aside>
  );
}
