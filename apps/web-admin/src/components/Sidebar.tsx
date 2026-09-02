"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { BILLING_TEST_PARENT } from "@/app/(app)/billing-test/nav";
import { DB_PARENT } from "@/app/(app)/manage-database/nav";
import { INTAKE_PARENT } from "@/app/(app)/enricher-config/nav";
import { FILTERS_PARENT } from "@/app/(app)/filters-config/nav";
import { INVITATIONS_PARENT } from "@/app/(app)/invitations/nav";
import { ORDERS_PARENT } from "@/app/(app)/orders-config/nav";
import { RESERVATIONS_PARENT } from "@/app/(app)/reservations-config/nav";
import { VISITS_PARENT } from "@/app/(app)/visits-config/nav";
import { REWARDS_PARENT } from "@/app/(app)/rewards-config/nav";
import { CONTROLS_PARENT } from "@/app/(app)/controls-config/nav";
import {
  parsePlaceId,
  TOOL_ROUTES,
} from "@/app/(app)/manage-single/nav";

function isNavActive(
  pathname: string,
  href: string,
  projectId: string | null,
): boolean {
  if (href === "/manage-single/select") {
    // One nav item covers the whole single-place surface (select + create redirects + editors).
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
// then the places Mesita lists, then the one guest-side record an operator
// writes by hand. Not Configurations; nothing here is a policy blob. Places
// keep the Multiple/Single qualifier because there are two surfaces to tell
// apart. Invitations is last because it is the narrowest: not consumers at
// large — every other class is earned — but the single INVITATION DOOR, which
// by definition only opens by hand (MESITA-972, MESITA-1160).
const MANAGE_NAV: NavItem[] = [
  DB_PARENT,
  { href: "/manage-multiple", label: "Multiple Places", Icon: Building2 },
  ...TOOL_ROUTES,
  INVITATIONS_PARENT,
];

// Configurations — ordered as the product flows, not alphabetically or by age.
// Two lifecycles end to end, a place's then a guest's:
//   platform  who operates the console, then which model everything runs on
//   supply    a place's life, all of it on ONE page: eligible to enter, then
//             the Intaker that fills its profile (Intake; the profile SPEC is
//             Notion Atlas Rules — nothing to configure, so no page) → how
//             ownership gets sealed (Verification)
//   demand    a guest's night: how they find a place (Discovery) → how they
//             book it (Reservations) → the journey once they sit down (Visits,
//             the local context) → or ordering without going at all (Orders,
//             the remote one) → what either context pays them (Promos)
//   proof     who reads the screenshot (Ojo) — composed onto Visits, not a
//             rail row; blob stays ojo_config
//
// Ojo is not a sidebar row: it is the proof reader for THE TICKET, so its
// knobs live on Visits. Orders still runs ahead of a reader (Soon).
//
// Memo is NOT a row here: Home › Chat is Memo, and it belongs to Discovery
// because it IS the chat engine. It has no editor at all — it runs on in-code
// defaults, so there is no Chat tab and nothing to give a rail row to.
// Access — who may enter the console at all. Its own group (Pato, 2026-08-21)
// because it is not a policy blob: every other Configurations row tunes how
// the PRODUCT behaves, while this one decides who gets to tune them. It sits
// below Configurations rather than beside Account: an operator opens it a few
// times a year, and the rail should lead with what they use daily.
//
// Label only: the row lists WHO has access, so it is a plural noun. Route,
// actions and EF names stay `admin-config` / `admin-web-*` — a rename stops
// at the label.
const ACCESS_NAV: NavItem[] = [
  { href: "/admin-config", label: "Admins", Icon: ShieldCheck },
];

/**
 * THE CONFIG PAGE SET IS CODE-DEFINED. This array is the SoT — never mirror
 * the list into a doc, a comment or a skill file (MESITA-1225).
 *
 * Every prose copy of it drifted within two days of the MESITA-1175 rail
 * rework: Rules §0, Product Rules §A, the doctor's Scope 4 and the comment
 * block 20 lines above this one all disagreed with each other and with the
 * console. Same argument `_shared/channels.ts` makes about `ChannelKey`, and
 * `_shared/discovery-signals.ts` about `SIGNAL_KEYS` — neither has ever
 * drifted, because there is nothing to copy.
 *
 * Anything that needs to know the set imports it. Anything that only needs to
 * NAME it points here instead of enumerating.
 */
const CONFIGURATIONS_NAV: NavItem[] = [
  // General absorbed Models and Verification (MESITA-1175): a page whose
  // whole content is three controls does not earn a rail row. Ojo's policy
  // lives on Visits (who reads the proof); /ojo-config redirects there.
  // Models and Verification routes still redirect into General.
  { href: "/general-config", label: "General", Icon: Settings2 },
  // INTAKE is one row for the Intaker: Models · Create · Enrich ·
  // Functions. Search eligibility is Discovery › Map. /sourcing-config
  // redirects there.
  INTAKE_PARENT,
  FILTERS_PARENT,
  VISITS_PARENT,
  ORDERS_PARENT,
  RESERVATIONS_PARENT,
  REWARDS_PARENT,
  CONTROLS_PARENT,
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
  { id: "access", label: "Access", items: ACCESS_NAV },
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
        "flex items-center rounded-xl text-xs font-medium transition lg:type-body " +
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
      <span className="text-background/35 type-meta font-medium tracking-[0.14em] uppercase">
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
  const projectId = parsePlaceId(pathname);

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
        "text-background/45 hover:bg-background/10 hover:text-background mt-1 flex shrink-0 items-center rounded-xl py-2 text-xs font-medium transition " +
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
            <span className="text-background/50 type-meta font-medium tracking-[0.14em] uppercase">
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
