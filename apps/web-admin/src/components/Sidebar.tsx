"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { ANALYTICS_PARENT } from "@/app/(app)/analytics/nav";
import { BILLING_TEST_PARENT } from "@/app/(app)/billing-test/nav";
import { LOGS_PARENT } from "@/app/(app)/logs/nav";
import { DB_PARENT } from "@/app/(app)/manage-database/nav";
import { GUESTS_PARENT } from "@/app/(app)/guests/nav";
import { MULTIPLE_PLACES_PARENT } from "@/app/(app)/manage-multiple/nav";
import { SINGLE_PLACE_PARENT } from "@/app/(app)/manage-single/nav";
import { FAMILIES_PARENT } from "@/app/(app)/families/nav";
import {
  CREATION_PARENT,
  ENRICHMENT_PARENT,
  UPDATING_PARENT,
} from "@/app/(app)/enricher-config/nav";
import { FILTERS_PARENT } from "@/app/(app)/filters-config/nav";
import { RESERVATIONS_PARENT } from "@/app/(app)/reservations-config/nav";
import { MODELS_PARENT } from "@/app/(app)/models-config/nav";
import { isNavActive } from "@/lib/nav-active";

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
// "Configurations", so no item ends in "Config" (MESITA-1073).
// Each label lives in its route's nav.ts; the Sidebar is their only consumer.
const PRIMARY_NAV: NavItem[] = [
  { href: "/account", label: "Account", Icon: UserRound },
];

// The MVP First Stage rail (MESITA-2088): Account · Manage · Configurations ·
// Testing. Alerts (Global Monitor, Credits Liability) are deleted, routes and
// all — Pato, 2026-10-10: "kill the stupid alerts". Testing › Billing went
// with them and came back the same day (MESITA-2125).

// Manage — the records of real things. Admins first (Pato, 2026-09-12):
// who may operate the console is a record, not a policy blob, and a
// one-item heading is a subsection we do not want. Label only: the row
// lists WHO has access, so it is a plural noun. Route, actions and EF
// names stay `admin-config` / `admin-web-*` — a rename stops at the
// label. Then widest scope: the backend itself, then the places Mesita
// lists — MANY at once, then ONE (Pato, MESITA-2084: "Multiple Places /
// Single Place"). Guests sits right after Admins (MESITA-2550): both rows
// are people. Single Place is the one-place sibling of the bulk tool,
// not the per-place editor MESITA-1588 deleted. Not Configurations;
// nothing here is a policy blob.
export const MANAGE_NAV: NavItem[] = [
  { href: "/admin-config", label: "Admins", Icon: ShieldCheck },
  GUESTS_PARENT,
  DB_PARENT,
  MULTIPLE_PLACES_PARENT,
  SINGLE_PLACE_PARENT,
];

// Configurations — six rows. Models, then Atlas (the Google-search
// switches, then FamiliesIA DNA, Google categories, Mesita categories,
// and every tag), then Creation, Enrichment, Discovery, Reservations.
// The row left Manage for this rail (Pato, 2026-10-13) and took the name
// Atlas (Pato, 2026-10-14). The rest stays the MESITA-2083 order: which
// model each subsystem thinks with, then a place's life (Creation, then
// Enrichment), then a guest's night (how they find a place, how they book it).
//
// Visits (with Ojo and Visits Rewards), Orders and Payments were off-rail
// pages until MESITA-2088 deleted them: the MVP has no Second Stage.
//
// Memo is NOT a row here: Home › Chat is Memo, and it belongs to Discovery
// because it IS the chat engine. It has no editor at all — it runs on in-code
// defaults, so there is no Chat tab and nothing to give a rail row to.

/**
 * THE CONFIG PAGE SET IS CODE-DEFINED. This array is the SoT — never mirror
 * the list into a doc, a comment or a skill file (MESITA-1225).
 *
 * Every prose copy of it drifted within two days of the MESITA-1175 rail
 * rework: Rules §0, Product Rules §A, the doctor's Scope 4 and the comment
 * block 20 lines above this one all disagreed with each other and with the
 * console. Same argument `_shared/channels.ts` makes about `ChannelKey` — it
 * has never drifted, because there is nothing to copy.
 *
 * Anything that needs to know the set imports it. Anything that only needs to
 * NAME it points here instead of enumerating.
 */
export const CONFIGURATIONS_NAV: NavItem[] = [
  // Models — four platform picks. /general-config redirects here (MESITA-1788).
  MODELS_PARENT,
  // Taxonomy. The switches write discovery_config. The lists do not.
  FAMILIES_PARENT,
  // Crenup's two halves.
  CREATION_PARENT,
  ENRICHMENT_PARENT,
  UPDATING_PARENT,
  // Discovery.
  FILTERS_PARENT,
  RESERVATIONS_PARENT,
];

// Activity — platform observability (MESITA-2745): counters, feed, breakdowns.
export const ACTIVITY_NAV: NavItem[] = [LOGS_PARENT, ANALYTICS_PARENT];

// Testing — operator tools that probe live external systems (Billing only).
const TESTING_NAV: NavItem[] = [BILLING_TEST_PARENT];

// The first group is deliberately unlabelled: a heading reading "Account" above
// a lone "Account" link is the redundancy this menu is trying to shed.
const SIDEBAR_SECTIONS: {
  id: string;
  label: string | null;
  items: NavItem[];
}[] = [
  { id: "primary", label: null, items: PRIMARY_NAV },
  { id: "manage", label: "Manage", items: MANAGE_NAV },
  { id: "configurations", label: "Configurations", items: CONFIGURATIONS_NAV },
  { id: "activity", label: "Activity", items: ACTIVITY_NAV },
  { id: "testing", label: "Testing", items: TESTING_NAV },
];

function NavLink({
  href,
  label,
  Icon,
  active,
  collapsed,
  onNavigate,
}: NavItem & {
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
      // The drawer instance is a TOUCH target, the desktop rail a pointer one,
      // so the mobile sizes are the larger pair and `lg:` tightens them back
      // down. Before this the base styles were the desktop rail's and the
      // drawer inherited 26px-tall rows on a phone.
      className={
        "flex items-center rounded-xl text-sm font-medium transition lg:text-xs lg:type-body " +
        (collapsed
          ? "justify-center py-2 "
          : "min-h-11 gap-3 px-3 lg:min-h-0 lg:gap-2.5 lg:px-2.5 lg:py-2 ") +
        (active
          ? "bg-secondary text-secondary-foreground"
          : "text-background/60 hover:bg-background/10 hover:text-background")
      }
    >
      <Icon
        className={
          collapsed ? "h-4 w-4 shrink-0" : "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5"
        }
      />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 lg:px-2.5 lg:pt-2">
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

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
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
                active={isNavActive(pathname, href)}
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
    <aside className="bg-foreground text-background border-background/10 pb-safe flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 lg:px-2.5 lg:pb-3">
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
