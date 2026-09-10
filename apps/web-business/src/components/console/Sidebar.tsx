"use client";

// The whole navigation: one lateral rail. Client because active state needs
// usePathname and every href carries the active organization.
//
// FLAT. EVERY ROW AT ONE INDENT (MESITA-1714). The first version grouped by
// indenting: Places, then its two filters one level in, then the open place one
// level in from those. Pato rejected it on sight and the reason is measurable —
// the ACTIVE row is almost always a leaf, so grouping by indent puts the most
// important row on screen at the deepest inset, where it reads as the least
// important. Hierarchy inverted.
//
// Grouping now comes from a hairline plus a small uppercase label, which cost
// no indentation at all. No tree lines, no bullet dots, no `depth` prop. That
// is also exactly the pattern web-admin's rail has always used.
//
// WHY A RAIL AT ALL. The old top bar was at its ceiling: MESITA-1614 merged Org
// Places and Public Places because a horizontal bar pays for every item in
// WIDTH. A vertical rail costs nothing per row, so the two labels are back as
// saved `?owned=` filters — with `All Places` kept above them, because dropping
// it would orphan the both-halves comparison the merge exists to protect.
//
// LIGHT, not admin's dark slab. `apps/web-business/CLAUDE.md`: light theme,
// semantic tokens, calm and high-density. Every text token is a semantic pair
// with a measured ratio (`muted-foreground` on `sidebar` is 6.31:1), never an
// opacity fraction — admin's rail ships three AA failures that way.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  SlidersHorizontal,
  Store,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useOpenPlace, useOpenPlaceGuard } from "@/components/console/OpenPlace";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeIdFromPathname,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabHref,
  type PlaceTab,
} from "@/lib/place-tabs";
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

const ROW_BASE =
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px]";
const ROW_REST =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
// The active row is a SOLID ink pill, not a tint. It is the one place in the
// rail where the console's foreground appears as a fill, which is what makes
// "you are here" survive a glance down a light column.
const ROW_ACTIVE = "bg-foreground text-background font-semibold";

const TAB_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: UserRound,
  capabilities: SlidersHorizontal,
  activity: Activity,
  admin: Shield,
};

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  /** Unsaved-edit guard. When it returns true it swallowed the click. */
  onGuardedNavigate?: (href: string, e: { preventDefault: () => void }) => boolean;
  title?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Ask before discarding, THEN close the drawer — closing first would
        // dismiss the rail out from under a dialog the person still has to
        // answer.
        if (onGuardedNavigate?.(href, e)) return;
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      // Collapsed, the icon is the only affordance, so the native tooltip is
      // what names the destination.
      title={collapsed ? label : title}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
  );
}

/** Groups without indenting. Collapsed there is no room for words, so the
 *  grouping survives as a rule — the same trade web-admin's rail makes. */
function SectionBreak({
  label,
  collapsed,
}: {
  label: string;
  collapsed: boolean;
}) {
  if (collapsed) {
    return <div className="border-sidebar-border mx-2 my-2 border-t" />;
  }
  return (
    <>
      <div className="border-sidebar-border mx-2 mt-3 mb-2 border-t" />
      <div className="px-2.5 pb-1">
        <span className={cn(TINY_LABEL_CLASS, "block truncate")} title={label}>
          {label}
        </span>
      </div>
    </>
  );
}

export function Sidebar({
  organizations,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ONE resolver for every piece of chrome — see lib/use-active-org.ts.
  const { activeOrg, activeOrgId } = useActiveOrg(organizations);

  const owned = ownedFromParam(searchParams.get("owned"));
  const openPlace = useOpenPlace();
  const guardNav = useOpenPlaceGuard();
  const openPlaceId = placeIdFromPathname(pathname);
  const onPlacesList = pathname === SHELL_ROUTES.places;

  const href = (to: string) => withOrg(to, activeOrgId);

  // Which of the place's views is open. Profile has no segment of its own —
  // it IS /places/<id> — so a bare place pathname means Profile.
  const activeTab: PlaceTab | null = openPlaceId
    ? ((pathname.split("/")[3] as PlaceTab | undefined) ?? "profile")
    : null;

  const switchHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("org", id);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      <Link
        href={href(SHELL_ROUTES.organization)}
        onClick={onNavigate}
        aria-label="Mesita business console"
        title={collapsed ? "Mesita business" : undefined}
        className={cn(
          "inline-flex shrink-0 items-center",
          collapsed ? "justify-center" : "gap-2 px-1.5",
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

      {/* WHICH ORGANIZATION. It scopes every row below it, so it sits above
          them. A <select> rather than a menu: keyboard- and screen-reader-
          native, and the rail has no room to reinvent one. One organization
          renders as a LABEL — in a rail the name is half the orientation, so
          it stays on screen either way. */}
      {!collapsed && (
        <div className="mt-3.5 shrink-0">
          {organizations.length > 1 ? (
            <select
              aria-label="Switch organization"
              value={activeOrgId ?? ""}
              onChange={(e) => {
                window.location.href = switchHref(e.target.value);
              }}
              className="border-sidebar-border bg-background text-foreground h-9 w-full truncate rounded-xl border px-2.5 text-[13px] font-semibold"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            <p
              title={activeOrg?.name ?? undefined}
              className="text-foreground truncate px-2.5 text-[13px] font-semibold"
            >
              {activeOrg?.name ?? "No organization"}
            </p>
          )}
        </div>
      )}

      <nav
        aria-label="Console"
        className="mt-3 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        <NavRow
          href={href(SHELL_ROUTES.organization)}
          label="Organization"
          Icon={Building2}
          active={pathname === SHELL_ROUTES.organization}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        {/* All Places is the UNFILTERED list — both halves at once, which is
            the comparison MESITA-1614 merged the screens to enable. The two
            rows under it are saved filters on the same route, not screens. */}
        <NavRow
          href={href(placesHref())}
          label="All Places"
          Icon={Store}
          active={onPlacesList && owned === null}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <NavRow
          href={href(placesHref("org"))}
          label="Org Places"
          Icon={Building2}
          active={onPlacesList && owned === "org"}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <NavRow
          href={href(placesHref("public"))}
          label="Public Places"
          Icon={Globe}
          active={onPlacesList && owned === "public"}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />

        {/* The open place is its own SECTION, not a child. It renders exactly
            the views this viewer may open — `visibleTabs()`, so 1 to 4. A
            greyed-out row for a view you cannot open is a worse answer than no
            row, and a person who only gets Profile should see one view, not
            four with three disabled. */}
        {openPlace && openPlace.id === openPlaceId && (
          <>
            <SectionBreak label={openPlace.name} collapsed={collapsed} />
            {openPlace.tabs.map((tab) => (
              <NavRow
                key={tab}
                href={placeTabHref(openPlace.id, tab, activeOrgId)}
                label={PLACE_TAB_LABEL[tab]}
                Icon={TAB_ICON[tab]}
                active={activeTab === tab}
                collapsed={collapsed}
                // Collapsed the label is just "Profile", which says nothing
                // about WHICH place, so the tooltip carries both.
                title={collapsed ? undefined : openPlace.name}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
          </>
        )}
      </nav>

      <div className="border-sidebar-border mt-2 shrink-0 border-t pt-2">
        <NavRow
          href={href(SHELL_ROUTES.account)}
          label="Account"
          Icon={UserRound}
          active={pathname === SHELL_ROUTES.account}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand menu" : "Collapse menu"}
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            aria-expanded={!collapsed}
            className={cn(
              ROW_BASE,
              ROW_REST,
              "mt-0.5 w-full",
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
        )}
      </div>
    </aside>
  );
}
