"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { ShieldCheckIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { BILLING_TEST_PARENT } from "@/app/(app)/billing-test/nav";
import { LOGS_PARENT } from "@/app/(app)/logs/nav";
import { DB_PARENT } from "@/app/(app)/manage-database/nav";
import { FEEDBACK_PARENT } from "@/app/(app)/feedback/nav";
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
import { FOCUS_RING_ON_DARK_CLASS } from "@/lib/ui-classes";

type SidebarProps = {
  onNavigate?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  Icon: Icon;
};

// Labels never repeat their section heading — the heading already says
// "Configurations", so no item ends in "Config" (MESITA-1073).
// Each label lives in its route's nav.ts; the Sidebar is their only consumer.
const ACCOUNT_NAV: NavItem = { href: "/account", label: "Account", Icon: UserCircleIcon };

// The MVP First Stage rail (MESITA-2088): Manage · Configurations · Activity ·
// Testing, with Account at the foot (MESITA-3261). Alerts (Global Monitor, Credits Liability) are deleted, routes and
// all — Pato, 2026-10-10: "kill the stupid alerts". Testing › Billing went
// with them and came back the same day (MESITA-2125).

// Manage — the records of real things. Admins first (Pato, 2026-09-12):
// who may operate the console is a record, not a policy blob, and a
// one-item heading is a subsection we do not want. Label only: the row
// lists WHO has access, so it is a plural noun. Route, actions and EF
// names stay `admin-config` / `admin-web-*` — a rename stops at the
// label. Then widest scope: the backend itself, then the places Mesita
// lists — MANY at once, then ONE (Pato, MESITA-2084: "Multiple Places /
// Single Place"). Guests was deleted (MESITA-3846). Single Place is the
// one-place sibling of the bulk tool, not the per-place editor MESITA-1588
// deleted. Premier closes the group
// (MESITA-3011): every place's paid visibility at once. Not Configurations;
// nothing here is a policy blob. Money left the rail (MESITA-3842).
export const MANAGE_NAV: NavItem[] = [
  { href: "/admin-config", label: "Admins", Icon: ShieldCheckIcon },
  DB_PARENT,
  MULTIPLE_PLACES_PARENT,
  SINGLE_PLACE_PARENT,
];

// Configurations — six rows. Models, then Atlas (the Mesita Families,
// Google's categories enabled and not enabled on Mesita, and every tag),
// then Creation, Enrichment, Discovery, Reservations.
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

// Activity — platform observability (MESITA-2745): the feed and logs.
// Analytics left (MESITA-3848, Pato: "Kill this analytics page").
// Feedback closes it (Pato, MESITA-3034: "feedback goes into activity"): what
// guests report from a place's three dots, a log like the other two.
export const ACTIVITY_NAV: NavItem[] = [LOGS_PARENT, FEEDBACK_PARENT];

// Testing — operator tools that probe live external systems (Billing only).
const TESTING_NAV: NavItem[] = [BILLING_TEST_PARENT];

const SIDEBAR_SECTIONS: {
  id: string;
  label: string;
  items: NavItem[];
}[] = [
  { id: "manage", label: "Manage", items: MANAGE_NAV },
  { id: "configurations", label: "Configurations", items: CONFIGURATIONS_NAV },
  { id: "activity", label: "Activity", items: ACTIVITY_NAV },
  { id: "testing", label: "Testing", items: TESTING_NAV },
];

/** "Mesita Admin" in the frame: Outfit, as Business and the consumer app draw
 *  the word. The font loads in the root layout, because a `next/font` call in
 *  this module would break `Sidebar.test.ts`. It inherits its colour, because
 *  it sits on the dark rail and on the light phone top bar. */
export function AdminWordmark() {
  return (
    <span className="flex items-baseline gap-2 select-none">
      <span className="font-(family-name:--font-wordmark) text-2xl leading-none font-bold tracking-[-0.03em]">
        Mesita
      </span>
      <span className="text-sm font-medium opacity-60">Admin</span>
    </span>
  );
}
/** One row size, from the Business rail: 40px with a 20px icon slot. The drawer
 *  is a touch target, so it starts at 44px and `lg:` tightens to 40. */
function NavLink({
  href,
  label,
  Icon: RowIcon,
  active,
  onNavigate,
}: NavItem & {
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors lg:min-h-10 ${FOCUS_RING_ON_DARK_CLASS} ` +
        (active
          ? "bg-background/15 text-background font-medium"
          : "text-background/75 hover:bg-background/10 hover:text-background")
      }
    >
      <span className="flex w-5 shrink-0 justify-center">
        <RowIcon size={20} weight={active ? "fill" : "regular"} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  // Width is the shell's call, so the rail fills its column. Only the groups
  // scroll, so Account stays reachable on a short window; `-mx-1 px-1` keeps
  // the rows' focus rings from clipping against the scroller.
  return (
    <aside className="border-background/10 bg-foreground text-background pb-safe flex h-full w-full flex-col overflow-hidden border-r px-3 pt-5 scheme-dark lg:pb-3">
      <Link
        href={MULTIPLE_PLACES_PARENT.href}
        onClick={onNavigate}
        title="Mesita Admin"
        className={`mb-5 flex h-10 shrink-0 items-center rounded-lg px-3 ${FOCUS_RING_ON_DARK_CLASS}`}
      >
        <AdminWordmark />
      </Link>

      <nav aria-label="Admin" className="flex min-h-0 flex-1 flex-col">
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-1 py-0.5">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.id} role="group" aria-label={section.label} className="flex flex-col gap-0.5">
              <p className="text-background/55 flex h-7 shrink-0 items-center px-3 text-xs font-semibold">
                {section.label}
              </p>
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  active={isNavActive(pathname, item.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="border-background/10 mt-2 shrink-0 border-t pt-2">
          <NavLink
            {...ACCOUNT_NAV}
            active={isNavActive(pathname, ACCOUNT_NAV.href)}
            onNavigate={onNavigate}
          />
        </div>
      </nav>
    </aside>
  );
}
