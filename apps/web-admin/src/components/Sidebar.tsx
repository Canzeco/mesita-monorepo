"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Radar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ATLAS_PARENT } from "@/app/(app)/atlas-config/nav";
import { ENRICHER_PARENT } from "@/app/(app)/enricher-config/nav";
import { SCORING_PARENT } from "@/app/(app)/scoring-config/nav";
import { SOURCING_PARENT } from "@/app/(app)/sourcing-config/nav";
import {
  parseUnitId,
  TOOL_ROUTES,
} from "@/app/(app)/manage-single/nav";

function isNavActive(
  pathname: string,
  href: string,
  projectId: string | null,
): boolean {
  if (href === "/manage-single/select") {
    // One nav item covers the whole single-unit surface (select + create redirects + editors).
    return (
      pathname === href ||
      pathname === "/manage-single" ||
      pathname.startsWith("/manage-single/") ||
      projectId !== null
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarProps = {
  onNavigate?: () => void;
};

const SIDEBAR_NAV = [
  { href: "/global-performance", label: "Global Monitor", Icon: Radar },
  { href: "/admin-config", label: "Admin Config", Icon: ShieldCheck },
  {
    href: ATLAS_PARENT.href,
    label: ATLAS_PARENT.label,
    Icon: ATLAS_PARENT.Icon,
  },
  {
    href: SOURCING_PARENT.href,
    label: SOURCING_PARENT.label,
    Icon: SOURCING_PARENT.Icon,
  },
  {
    href: ENRICHER_PARENT.href,
    label: ENRICHER_PARENT.label,
    Icon: ENRICHER_PARENT.Icon,
  },
  {
    // Memo Config folded in as a Scoring tab — Memo is one of the three engines.
    href: SCORING_PARENT.href,
    label: SCORING_PARENT.label,
    Icon: SCORING_PARENT.Icon,
  },
  { href: "/manage-multiple", label: "Manage Multiple Units", Icon: Building2 },
  ...TOOL_ROUTES,
] as const;

function NavLink({
  href,
  label,
  Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={
        "pl-2.5 lg:pl-3 " +
        " flex items-center gap-2.5 rounded-2xl py-2 pr-2.5 text-[13px] font-medium transition lg:gap-3 lg:py-2.5 lg:pr-3 lg:text-sm " +
        (active
          ? "bg-secondary text-secondary-foreground"
          : "text-background/60 hover:bg-background/10 hover:text-background")
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarDivider() {
  return <div className="border-background/10 border-t" role="separator" />;
}

function SectionGap() {
  return <div className="py-2" />;
}

export function SidebarNav({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const projectId = parseUnitId(pathname);

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      <NavLink
        href="/account"
        label="Account"
        Icon={UserRound}
        active={pathname === "/account" || pathname.startsWith("/account/")}
        onNavigate={onNavigate}
      />

      <SectionGap />
      <SidebarDivider />
      <SectionGap />

      {SIDEBAR_NAV.map(({ href, label, Icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          Icon={Icon}
          active={isNavActive(pathname, href, projectId)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  // Dark lateral rail — only the main menu is inverted; content stays light.
  return (
    <aside className="bg-foreground text-background flex h-full w-56 shrink-0 flex-col overflow-hidden border-r border-background/10 px-2.5 pt-5 pb-4 lg:w-64 lg:px-3">
      <Link
        href="/central"
        onClick={onNavigate}
        className="inline-flex shrink-0 items-center gap-2 px-2"
      >
        <span className="bg-peacock shadow-glow flex h-7 w-7 items-center justify-center rounded-full text-sm">
          🦚
        </span>
        <span className="font-display text-base font-semibold tracking-tight">
          mesita
          <span className="text-primary">.</span>
          <span className="text-background/50 ml-1.5 text-[10px] font-medium tracking-[0.16em] uppercase">
            admin
          </span>
        </span>
      </Link>

      <SectionGap />
      <SidebarDivider />
      <SectionGap />

      <SidebarNav onNavigate={onNavigate} />
    </aside>
  );
}
