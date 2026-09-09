"use client";

// The whole navigation: one lateral rail (MESITA-1710). Client because active
// state needs usePathname and every href carries the active organization.
//
// WHY A RAIL. The old top bar was at its ceiling. MESITA-1614 merged Org
// Places and Public Places because a horizontal bar pays for every item in
// WIDTH, so a pre-applied filter could not justify a whole screen. A vertical
// rail nests and costs nothing per row — so the two labels come back as
// CHILDREN of one list rather than as two routes, and the merge survives
// untouched (see `placesHref` in lib/console-routes.ts).
//
// LIGHT, not admin's dark slab. `apps/web-business/CLAUDE.md`: light theme,
// semantic tokens, calm and high-density. Admin's rail is `bg-foreground` —
// operator furniture. This console is the one a restaurant owner touches, so
// it uses the `--sidebar` token family the theme already defines: a paper tone
// a half-step off the page, separated by a hairline rather than by inversion.
//
// CONTRAST IS MEASURED, NOT INHERITED. Admin's rail ships three AA failures
// (`text-background/35` eyebrows at ~3.3:1, `/45` collapse toggle at 4.36:1).
// Every text token here is a semantic pair with a measured ratio:
// `muted-foreground` on `sidebar` is 6.31:1, `foreground` on `sidebar` 17.9:1,
// and the active pill's `background` on `foreground` 18.1:1.
//
// TOP TO BOTTOM: wordmark, then the organization switcher (it SCOPES every row
// below it, so it sits above every row below it), then the nav, then Account
// pinned to the floor — identity, not scope, so it leaves the flow entirely.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { useOpenPlace } from "@/components/console/OpenPlace";
import {
  SHELL_ROUTES,
  ownedFromParam,
  placeHref,
  placeIdFromPathname,
  placesHref,
  withOrg,
} from "@/lib/console-routes";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import type { Organization } from "@/lib/api/organizations";

type SidebarProps = {
  organizations: Pick<Organization, "id" | "name">[];
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
  /** Icon-only rail. Desktop instance only — the drawer is always full. */
  collapsed?: boolean;
  /** Absent on the drawer instance, which has no collapsed state to toggle. */
  onToggleCollapse?: () => void;
};

const ROW_BASE =
  "flex items-center rounded-xl text-sm font-medium transition min-h-11 gap-2.5 px-2.5 lg:min-h-0 lg:py-2 lg:text-[13px]";
const ROW_REST =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
// The active row is a SOLID ink pill, not a tint. It is the one place in the
// rail where the console's own foreground appears as a fill, which is what
// makes "you are here" readable at a glance in a light column.
const ROW_ACTIVE = "bg-foreground text-background font-semibold";

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  depth = 0,
  onNavigate,
  title,
}: {
  href: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  /** 0 = top level, 1 = a Places filter, 2 = the open place under its filter. */
  depth?: 0 | 1 | 2;
  onNavigate?: () => void;
  title?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // Collapsed, the icon is the only affordance, so the native tooltip is
      // what names the destination.
      title={collapsed ? label : title}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        collapsed && "justify-center px-0 py-2",
      )}
      style={
        collapsed || depth === 0
          ? undefined
          : // Indent in the padding, not with a wrapper: the row's hover and
            // active fill must still span the full rail width, or a nested row
            // reads as a different kind of control.
            { paddingLeft: `${0.625 + depth * 0.875}rem` }
      }
    >
      {Icon ? (
        <Icon className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5" />
      ) : collapsed ? null : (
        // Children have no icon of their own — a second glyph one level in
        // reads as a second category. The tick is a position marker.
        <span
          aria-hidden
          className={cn(
            "h-1 w-1 shrink-0 rounded-full",
            active ? "bg-background" : "bg-muted-foreground/50",
          )}
        />
      )}
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </Link>
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

  // The active organization is resolved HERE, not passed down: the layout that
  // renders this cannot read searchParams, so it would have had to guess. Same
  // fallback rule the pages use — ?org= when it names one you belong to, else
  // the first.
  const requested = searchParams.get("org");
  const activeOrgId =
    (requested && organizations.some((o) => o.id === requested)
      ? requested
      : organizations[0]?.id) ?? null;
  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;

  const owned = ownedFromParam(searchParams.get("owned"));
  const openPlace = useOpenPlace();
  // Exact, not prefix: /places/<id> is the place, not the list.
  const openPlaceId = placeIdFromPathname(pathname);
  const onPlacesList = pathname === SHELL_ROUTES.places;

  const href = (to: string) => withOrg(to, activeOrgId);

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
            {/* TINY_LABEL_CLASS, never a bare <span> with its own sizes and
                never a heading tag: globals.css puts every bare h1/h2/h3 on
                the display face, so a 10px eyebrow written as an <h2> would
                silently become a serif. */}
            <span className={TINY_LABEL_CLASS}>business</span>
          </>
        )}
      </Link>

      {/* WHICH ORGANIZATION. It scopes every row below it, so it sits above
          them. A <select> rather than a menu: it is the same control the top
          bar carried, it is keyboard- and screen-reader-native, and the rail
          has no room to reinvent one.

          One organization renders as a LABEL, not a disabled control. The old
          bar hid the switcher entirely below two orgs; in a rail the name is
          half the orientation, so it stays on screen either way. */}
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
        />

        {/* The parent is the WHOLE list — both halves, the comparison the
            merge exists to protect. The children pre-filter it. */}
        <NavRow
          href={href(placesHref())}
          label="Places"
          Icon={Store}
          active={onPlacesList && owned === null}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {!collapsed && (
          <>
            <NavRow
              href={href(placesHref("org"))}
              label="Org Places"
              active={onPlacesList && owned === "org"}
              collapsed={collapsed}
              depth={1}
              onNavigate={onNavigate}
            />
            {openPlace && openPlace.owned && (
              <NavRow
                href={href(placeHref(openPlace.id))}
                label={openPlace.name}
                title={openPlace.name}
                active={openPlaceId === openPlace.id}
                collapsed={collapsed}
                depth={2}
                onNavigate={onNavigate}
              />
            )}
            <NavRow
              href={href(placesHref("public"))}
              label="Public Places"
              active={onPlacesList && owned === "public"}
              collapsed={collapsed}
              depth={1}
              onNavigate={onNavigate}
            />
            {openPlace && !openPlace.owned && (
              <NavRow
                href={href(placeHref(openPlace.id))}
                label={openPlace.name}
                title={openPlace.name}
                active={openPlaceId === openPlace.id}
                collapsed={collapsed}
                depth={2}
                onNavigate={onNavigate}
              />
            )}
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
