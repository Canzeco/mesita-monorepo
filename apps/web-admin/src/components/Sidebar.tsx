"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { BILLING_TEST_PARENT } from "@/app/(app)/billing-test/nav";
import { DB_PARENT } from "@/app/(app)/manage-database/nav";
import { ENRICHER_PARENT } from "@/app/(app)/enricher-config/nav";
import { FILTERS_PARENT } from "@/app/(app)/filters-config/nav";
import { MODELS_PARENT } from "@/app/(app)/models-config/nav";
import { OJO_PARENT } from "@/app/(app)/ojo-config/nav";
import { RESERVATIONS_PARENT } from "@/app/(app)/reservations-config/nav";
import { REWARDS_PARENT } from "@/app/(app)/rewards-config/nav";
import { SOURCING_PARENT } from "@/app/(app)/sourcing-config/nav";
import { VERIFICATION_PARENT } from "@/app/(app)/verification-config/nav";
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
  /** Icon-only rail. Desktop instance only — the mobile drawer is always full. */
  collapsed?: boolean;
  /** Omitted on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

// Labels never repeat their section heading — the heading already says
// "Configurations", so the item is "Atlas", not "Atlas Config" (MESITA-1073).
// Each label lives in its route's nav.ts; the Sidebar is their only consumer.
const PRIMARY_NAV: NavItem[] = [
  { href: "/account", label: "Account", Icon: UserRound },
];

const ALERTS_NAV: NavItem[] = [
  { href: "/global-performance", label: "Global Monitor", Icon: Radar },
  { href: "/verifications", label: "Verification Queue", Icon: BadgeCheck },
];

// Manage — the records of real things, widest scope first: the backend itself,
// then the units Mesita lists. Not Configurations; nothing here is a policy
// blob. Units keep the Multiple/Single qualifier because there are two
// surfaces to tell apart. There is no consumers row: every class is earned,
// so the console has nothing to grant by hand.
const MANAGE_NAV: NavItem[] = [
  DB_PARENT,
  { href: "/manage-multiple", label: "Multiple Units", Icon: Building2 },
  ...TOOL_ROUTES,
];

// Configurations — ordered as the product flows, not alphabetically or by age.
// Two lifecycles end to end, a place's then a guest's:
//   platform  who operates the console, then which model everything runs on
//   supply    a place's life: eligible to enter (Sourcing) → the pipeline that
//             fills its profile (Enricher; the profile SPEC is Notion Atlas
//             Rules — nothing to configure, so no page) → how ownership gets
//             sealed (Verification)
//   demand    a guest's night: how they find a place (Filters) → how they book
//             it (Reservations) → what the visit pays them (Promos)
//   proof     what happens after they leave: is the screenshot real (Ojo)
//
// Ojo trails everything because it reads a proof submitted AFTER the visit —
// it is the last step of the last lifecycle, and the only config here whose
// engine isn't built yet.
//
// Memo is NOT a row here: Home › Chat is Memo, so its config lives inside
// Filters Config › Chat rather than as a sibling of the surface it powers.
const CONFIGURATIONS_NAV: NavItem[] = [
  { href: "/admin-config", label: "Admin", Icon: ShieldCheck },
  MODELS_PARENT,
  SOURCING_PARENT,
  ENRICHER_PARENT,
  VERIFICATION_PARENT,
  FILTERS_PARENT,
  RESERVATIONS_PARENT,
  REWARDS_PARENT,
  OJO_PARENT,
];

// Testing — operator tools that probe live systems rather than configure them.
const TESTING_NAV: NavItem[] = [
  {
    href: BILLING_TEST_PARENT.href,
    label: BILLING_TEST_PARENT.label,
    Icon: BILLING_TEST_PARENT.Icon,
  },
];

// The first group is deliberately unlabelled: a heading reading "Account" above
// a lone "Account" link is the redundancy this menu is trying to shed.
const SIDEBAR_SECTIONS: {
  id: string;
  label: string | null;
  items: NavItem[];
}[] = [
  { id: "primary", label: null, items: PRIMARY_NAV },
  { id: "alerts", label: "Alerts", items: ALERTS_NAV },
  { id: "manage", label: "Manage", items: MANAGE_NAV },
  { id: "configurations", label: "Configurations", items: CONFIGURATIONS_NAV },
  { id: "testing", label: "Testing", items: TESTING_NAV },
];

function NavLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      // Collapsed, the icon is the only affordance — the native tooltip is
      // what names the destination.
      title={collapsed ? label : undefined}
      className={
        "flex items-center rounded-xl text-[12px] font-medium transition lg:text-[12.5px] " +
        (collapsed
          ? "justify-center py-2 "
          : "gap-2 py-1.5 pr-2 pl-2 lg:gap-2.5 lg:py-2 lg:pr-2.5 lg:pl-2.5 ") +
        (active
          ? "bg-secondary text-secondary-foreground"
          : "text-background/60 hover:bg-background/10 hover:text-background")
      }
    >
      <Icon className={collapsed ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 lg:px-2.5">
      <span className="text-background/35 text-[9px] font-medium tracking-[0.14em] uppercase">
        {children}
      </span>
    </div>
  );
}

function SectionGap() {
  return <div className="py-1" />;
}

// Collapsed there is no room for a heading, so the grouping survives as a rule.
function SectionRule() {
  return <div className="border-background/10 mx-1.5 my-2 border-t" />;
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const projectId = parseUnitId(pathname);

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
      {SIDEBAR_SECTIONS.map((section, index) => (
        <div key={section.id}>
          {index === 0 ? null : collapsed ? <SectionRule /> : <SectionGap />}
          {collapsed || !section.label ? null : (
            <SectionLabel>{section.label}</SectionLabel>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, Icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isNavActive(pathname, href, projectId)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const action = collapsed ? "Expand menu" : "Collapse menu";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={action}
      aria-label={action}
      aria-expanded={!collapsed}
      className={
        "text-background/45 hover:bg-background/10 hover:text-background mt-1 flex shrink-0 items-center rounded-xl py-2 text-[12px] font-medium transition " +
        (collapsed ? "justify-center" : "gap-2.5 px-2.5")
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {collapsed ? null : <span className="truncate">Collapse</span>}
    </button>
  );
}

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  // Dark lateral rail — only the main menu is inverted; content stays light.
  // Width is the shell's call (it animates the column), so the rail fills it.
  return (
    <aside className="bg-foreground text-background border-background/10 flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3 lg:px-2.5">
      <Link
        href="/central"
        onClick={onNavigate}
        title={collapsed ? "Mesita admin" : undefined}
        className={
          "inline-flex shrink-0 items-center " +
          (collapsed ? "justify-center" : "gap-2 px-2")
        }
      >
        {collapsed ? (
          <MesitaMark className="h-5 w-5" />
        ) : (
          <>
            <MesitaLogo variant="horizontal" className="h-5 w-auto" />
            <span className="text-background/50 text-[10px] font-medium tracking-[0.16em] uppercase">
              admin
            </span>
          </>
        )}
      </Link>

      <SectionGap />

      <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />

      {onToggleCollapse ? (
        <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} />
      ) : null}
    </aside>
  );
}
