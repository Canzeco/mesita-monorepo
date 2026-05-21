"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  FilePen,
  ListPlus,
  ListChecks,
  ListFilter,
  LogOut,
} from "lucide-react";
import { authSignOut } from "@/app/auth/actions";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

// Verifications were dropped from the sidebar when ownership flipped
// to fully-automatic (phone OTP / video AI / WhatsApp fallback) — the
// /verifications route still exists as the admin escape hatch for
// manual grants, but it's not part of the day-to-day surface.
const UNIT_NAV: NavItem[] = [
  { href: "/update", label: "Manually update unit", Icon: FilePen },
  { href: "/bulk-search", label: "Bulk search units", Icon: ListFilter },
  { href: "/bulk-create", label: "Bulk create units", Icon: ListPlus },
  { href: "/bulk-update", label: "Bulk update units", Icon: ListChecks },
];

const INBOX_NAV: NavItem[] = [
  { href: "/notifications", label: "Notifications", Icon: Bell },
];

const DANGER_NAV: NavItem[] = [
  { href: "/danger", label: "Danger zone", Icon: AlertTriangle },
];

export function Sidebar({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="border-border bg-card flex h-full w-64 shrink-0 flex-col gap-6 overflow-hidden border-r px-3 pt-5 pb-4">
      <Link href="/central" className="inline-flex items-center gap-2 px-2">
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

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        <NavSection label="Units" items={UNIT_NAV} pathname={pathname} />
        <NavSection label="Inbox" items={INBOX_NAV} pathname={pathname} />
        <NavSection label="Danger" items={DANGER_NAV} pathname={pathname} />
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

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground px-2 pb-1 text-[10px] font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      {items.map(({ href, label, Icon }) => {
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
    </div>
  );
}
