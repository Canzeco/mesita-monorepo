"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  FilePen,
  ListPlus,
  ListChecks,
  ListFilter,
  KeyRound,
  X,
} from "lucide-react";
import { authClearKey } from "@/app/login/actions";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const UNIT_NAV: NavItem[] = [
  { href: "/verifications", label: "Unit verification requests", Icon: BadgeCheck },
  { href: "/update", label: "Manually update unit", Icon: FilePen },
  { href: "/bulk-search", label: "Bulk search units", Icon: ListFilter },
  { href: "/bulk-create", label: "Bulk create units", Icon: ListPlus },
  { href: "/bulk-update", label: "Bulk update units", Icon: ListChecks },
];

export function Sidebar({ hasKey }: { hasKey: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-card flex h-dvh w-64 shrink-0 flex-col gap-6 border-r px-3 pt-5 pb-4">
      <Link href="/" className="inline-flex items-center gap-2 px-2">
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

      <nav className="flex flex-1 flex-col gap-1">
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

      {hasKey ? (
        <form action={authClearKey}>
          <button
            type="submit"
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <KeyRound className="text-secondary h-4 w-4" />
            </span>
            <span className="flex-1 text-left">Admin key set</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition"
        >
          <KeyRound className="h-4 w-4" />
          <span className="flex-1 text-left">Set admin key</span>
        </Link>
      )}
    </aside>
  );
}
