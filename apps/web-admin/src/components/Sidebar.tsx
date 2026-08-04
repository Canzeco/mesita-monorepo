"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  Radar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { ATLAS_PARENT } from "@/app/(app)/atlas-config/nav";
import { AURA_PARENT } from "@/app/(app)/aura-config/nav";
import { BILLING_TEST_PARENT } from "@/app/(app)/billing-test/nav";
import { DB_PARENT } from "@/app/(app)/db-config/nav";
import { ENRICHER_PARENT } from "@/app/(app)/enricher-config/nav";
import { MEMO_PARENT } from "@/app/(app)/memo-config/nav";
import { MODELS_PARENT } from "@/app/(app)/models-config/nav";
import { RESERVATIONS_PARENT } from "@/app/(app)/reservations-config/nav";
import { REWARDS_PARENT } from "@/app/(app)/rewards-config/nav";
import { SCORING_PARENT } from "@/app/(app)/lineup-config/nav";
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

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const ACCOUNT_NAV: NavItem[] = [
  { href: "/account", label: "Account", Icon: UserRound },
];

const ALERTS_NAV: NavItem[] = [
  { href: "/global-performance", label: "Global Monitor", Icon: Radar },
  { href: "/verifications", label: "Verification Queue", Icon: BadgeCheck },
];

const CONFIGS_NAV: NavItem[] = [
  { href: "/admin-config", label: "Admin Config", Icon: ShieldCheck },
  DB_PARENT,
  MODELS_PARENT,
  ATLAS_PARENT,
  SOURCING_PARENT,
  ENRICHER_PARENT,
  SCORING_PARENT,
  REWARDS_PARENT,
  AURA_PARENT,
  MEMO_PARENT,
  RESERVATIONS_PARENT,
];

const MANAGE_NAV: NavItem[] = [
  { href: "/manage-multiple", label: "Manage Multiple Units", Icon: Building2 },
  ...TOOL_ROUTES,
];

// Testing — operator tools that probe live systems rather than configure them.
const TESTING_NAV: NavItem[] = [
  {
    href: BILLING_TEST_PARENT.href,
    label: BILLING_TEST_PARENT.label,
    Icon: BILLING_TEST_PARENT.Icon,
  },
];

const SIDEBAR_SECTIONS = [
  { label: "Account", items: ACCOUNT_NAV },
  { label: "Alerts", items: ALERTS_NAV },
  { label: "Configs", items: CONFIGS_NAV },
  { label: "Testing", items: TESTING_NAV },
  { label: "Manage", items: MANAGE_NAV },
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pt-3 pb-1.5 lg:px-3">
      <span className="text-background/35 text-[10px] font-medium tracking-[0.14em] uppercase">
        {children}
      </span>
    </div>
  );
}

function SectionGap() {
  return <div className="py-2" />;
}

function SidebarNav({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const projectId = parseUnitId(pathname);

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {SIDEBAR_SECTIONS.map((section, index) => (
        <div key={section.label}>
          {index > 0 ? <SectionGap /> : null}
          <SectionLabel>{section.label}</SectionLabel>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, Icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isNavActive(pathname, href, projectId)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
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

      <SidebarNav onNavigate={onNavigate} />
    </aside>
  );
}
