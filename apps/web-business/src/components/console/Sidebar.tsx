"use client";

// The whole navigation: one lateral rail. Client because active state needs
// usePathname and every href carries the active organization.
//
// THREE COLLECTIONS (MESITA-1793). Account · Organizations · Places, then
// Collapse in the footer. No switcher in the rail, no nested place rows, no
// Org Places toggle, no All Places, no "No organization" chrome. The header
// switcher appears only when the account holds two or more organizations.
//
// CREATE IS A PLUS ON THE COLLECTION (MESITA-1800). Pato, 2026-09-12: the
// ceremonies have to be one click from the rail, not a visit to the list
// then a second click. Organizations and Places each grow a Plus — two
// targets on one line, the same split PlaceRow used for name vs chevron.
// The Plus is never a fifth/sixth destination: three collections stay the IA.
// Collapsed (`w-16`) hides it; two targets do not fit.
//
// FLAT. Nothing in this file indents — no inset, no tree line, no bullet,
// no `pl-8` — and `shell-chrome.test.ts` forbids all of them.
//
// Organizations is active on `/organization` and `/organization/new`.
// Places is active on `/places`, `/places/new`, and `/places/:id/*`.
// Create organization's href is bare `/organization/new` (no `?org=`).
// Claim place carries `?org=` because the claim writes into that org.

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Store,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useOpenPlaceGuard } from "@/components/console/OpenPlace";
import { SHELL_ROUTES, withOrg } from "@/lib/console-routes";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import { useActiveOrg, type ChromeOrg } from "@/lib/use-active-org";

type SidebarProps = {
  organizations: ChromeOrg[];
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop instance only — the drawer is always full. */
  collapsed?: boolean;
  /** Absent on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
};

// Focus travels through this rail on Tab, so the ring is the brand's, not the
// browser's: a themed ring is the cheapest tell that a surface was designed.
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const ROW_BASE = cn(
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px]",
  FOCUS_RING,
);
const ROW_REST =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
// The active row is a SOLID ink pill, not a tint. It is the one place in the
// rail where the console's foreground appears as a fill, which is what makes
// "you are here" survive a glance down a light column.
const ROW_ACTIVE = "bg-foreground text-background font-semibold";

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  onNavigate,
  onGuardedNavigate,
  title,
  className,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: (
    href: string,
    e: { preventDefault: () => void },
  ) => boolean;
  title?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        // NEVER guard the row you are already on. That click navigates
        // nowhere, so offering "discard your edits and leave" for it is an
        // offer to throw work away for nothing.
        if (!active) onGuardedNavigate?.(href, e);
        // Close the drawer either way. The discard dialog renders inside
        // `main`, behind the drawer's scrim, so leaving the rail up buries the
        // question the person now has to answer.
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : title}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        collapsed && "justify-center px-0 py-2",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

/**
 * A collection plus its ceremony. Two targets on one line: the name is the
 * list, the Plus is Create / Claim. Independent hover surfaces, because a
 * single treatment across both would advertise one target where there are
 * two. The Plus is never a pill — exactly one filled row, always the
 * collection. Hidden when collapsed: `w-16` has no room for two targets.
 */
function CollectionRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  createHref,
  createLabel,
  createActive,
  onNavigate,
  onGuardedNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  createHref: string;
  createLabel: string;
  createActive: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: (
    href: string,
    e: { preventDefault: () => void },
  ) => boolean;
}) {
  if (collapsed) {
    return (
      <NavRow
        href={href}
        label={label}
        Icon={Icon}
        active={active}
        collapsed
        onNavigate={onNavigate}
        onGuardedNavigate={onGuardedNavigate}
      />
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <NavRow
        href={href}
        label={label}
        Icon={Icon}
        active={active}
        collapsed={false}
        onNavigate={onNavigate}
        onGuardedNavigate={onGuardedNavigate}
        className="min-w-0 flex-1"
      />
      <Link
        href={createHref}
        aria-label={createLabel}
        title={createLabel}
        onClick={(e) => {
          if (!createActive) onGuardedNavigate?.(createHref, e);
          onNavigate?.();
        }}
        className={cn(
          "flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition lg:h-7 lg:min-h-0 lg:w-7",
          FOCUS_RING,
          "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
      >
        <Plus className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      </Link>
    </div>
  );
}

export function Sidebar({
  organizations,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { activeOrgId } = useActiveOrg(organizations);
  const guardNav = useOpenPlaceGuard();

  const href = (to: string) => withOrg(to, activeOrgId);

  const onOrganizations =
    pathname === SHELL_ROUTES.organization ||
    pathname.startsWith(`${SHELL_ROUTES.organization}/`);
  const onPlaces =
    pathname === SHELL_ROUTES.places ||
    pathname.startsWith(`${SHELL_ROUTES.places}/`);
  const onCreateOrg = pathname === SHELL_ROUTES.organizationNew;
  const onClaimPlace = pathname === SHELL_ROUTES.placesNew;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product. Who you are is the first row below. */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "justify-center" : "px-1.5",
        )}
      >
        <Link
          href={href(SHELL_ROUTES.organization)}
          // Guarded like every other route out of here. The Organizations ROW
          // is a few lines down and goes to the same place; one of them
          // silently discarding unsaved edits while the other asks is worse
          // than either rule applied consistently.
          onClick={(e) => {
            guardNav?.(href(SHELL_ROUTES.organization), e);
            onNavigate?.();
          }}
          aria-label="Mesita business console"
          title={collapsed ? "Mesita business" : undefined}
          className={cn(
            "inline-flex min-w-0 items-center rounded-md",
            FOCUS_RING,
            collapsed ? "justify-center" : "gap-2",
          )}
        >
          {collapsed ? (
            <MesitaMark className="h-5 w-5" />
          ) : (
            <>
              <MesitaLogo variant="horizontal" className="h-5 w-auto" />
              {/* TINY_LABEL_CLASS, never a heading tag: globals.css puts every
                  bare h1/h2/h3 on the display face, so a 10px eyebrow written as
                  an <h2> would silently become a serif. */}
              <span className={TINY_LABEL_CLASS}>business</span>
            </>
          )}
        </Link>
      </div>

      <nav
        aria-label="Console"
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        <NavRow
          href={href(SHELL_ROUTES.account)}
          label="Account"
          Icon={UserRound}
          active={pathname === SHELL_ROUTES.account}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <CollectionRow
          href={href(SHELL_ROUTES.organization)}
          label="Organizations"
          Icon={Building2}
          active={onOrganizations}
          collapsed={collapsed}
          createHref={SHELL_ROUTES.organizationNew}
          createLabel="Create organization"
          createActive={onCreateOrg}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <CollectionRow
          href={href(SHELL_ROUTES.places)}
          label="Places"
          Icon={Store}
          active={onPlaces}
          collapsed={collapsed}
          createHref={href(SHELL_ROUTES.placesNew)}
          createLabel="Claim a place"
          createActive={onClaimPlace}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
      </nav>

      {/* THE FOOTER IS THE RAIL'S OWN CONTROL, AND ONLY THAT: the one button
          that acts on the rail rather than navigating anywhere. */}
      {onToggleCollapse && (
        <div className="border-sidebar-border mt-2 shrink-0 border-t pt-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            className={cn(
              ROW_BASE,
              ROW_REST,
              "w-full",
              collapsed && "justify-center px-0 py-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
            )}
            <span className={collapsed ? "sr-only" : "truncate"}>Collapse</span>
          </button>
        </div>
      )}
    </aside>
  );
}
