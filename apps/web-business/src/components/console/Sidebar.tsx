"use client";

// The whole navigation: one lateral rail, SEVEN FLAT PAGES (MESITA-1815),
// each switcher above the rows it controls (MESITA-1818).
//
// Pato, 2026-09-13, on the three-box rail of MESITA-1807/1810: "it's too
// complex for one organization to manage multiple places too. It's just too
// enterprise." Then the shape: "Account. Organization (change organization,
// change place). Place Profile. Place Reviews. Place Activity. Place Settings.
// Place Admin. Better do it like this. Just seven pages. I don't care word
// place is redundant btw." Then, on 1815 live: "the organization and the
// place is select inside organization, kinda weird" — the design review
// (MESITA-1818) moved each switcher directly above its own rows.
//
//   [ ○ Account                  ]  the email rides the tooltip
//   ─────                            a seam: the box's replacement
//   [ [S] Strana Group      ⇅  + ]   org switcher; chevron only at 2+ orgs;
//   [ ▤ Organization             ]   its list and Add place light this row
//   ─────                            the org/place seam
//   [ [img] Strana Del Valle ⇅ + ]   place switcher; chevron only at 2+ places
//   [ ▢ Place Profile            ]   "Place " quieted by WEIGHT, never alpha
//   [ ★ Place Reviews            ]
//   [ ~ Place Activity    ▮pill  ]   exactly ONE filled pill, always —
//   [ ⚙ Place Settings           ]   on /orgs/new it is the org Plus
//   [ ⛨ Place Admin              ]   super-admin only
//   ─────
//   ◧ Collapse                       the footer: the rail's own control
//
// NO BOXES, NO EYEBROWS. Three groups, two seams: with boxes, eyebrows and
// indents all forbidden (trees rejected twice, 1714/1715; boxes once, 1815),
// a `border-sidebar-border` hairline is the only grouping device left, so it
// draws BOTH boundaries — one seam left the org switcher reading as
// Account's sibling. The rows carry their scope word themselves ("Place
// Settings", not a PLACE eyebrow over "Settings").
//
// A SWITCHER WITH NOTHING TO SWITCH IS A NAME. The majority customer is one
// organization holding one place; two menus that open on one item each is
// the "too enterprise" smell in miniature. At n=1 the chevron is not
// rendered and the row still opens the same menu — it is the door to Create
// organization, All places and Add place.
//
// THE SCOPE IS READ OFF THE PATHNAME (lib/rail-scope.ts). `/orgs/<id>/…`
// names the organization; `/places/<id>/…` names the place, and its holder
// is found across every organization the viewer is in; everything else falls
// back to the organization and place remembered from the last visit. The
// rail lists no portfolio: the switcher is the list. A switcher never
// carries the pill — it is a control, not a page.
//
// FLAT. Nothing in this file indents — no inset, no tree line, no bullet, no
// `pl-8` — and `shell-chrome.test.ts` forbids all of them.
//
// THE CHIP IS NOT A PILL. The switcher's leading chip sits on `bg-sidebar-accent`
// with a hairline, never on the pill's ink pair: at `w-16` two solid ink
// squares would read as two "you are here" marks. And the two chips never
// look alike there: the org chip is always a LETTER, the place chip always a
// photo or the Store glyph.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  ChevronsUpDown,
  FileText,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Shield,
  Star,
  Store,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { MesitaMark } from "@/components/brand/MesitaMark";
import {
  useOpenPlace,
  useOpenPlaceGuard,
  type GuardNav,
} from "@/components/console/OpenPlace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RailPlace } from "@/lib/api/organizations";
import { canAddPlace } from "@/lib/active-organization";
import {
  ORG_PAGE_LABEL,
  SHELL_ROUTES,
  orgHref,
  orgPageFromPathname,
  orgPlacesHref,
  orgPlacesNewHref,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import { placeThumbUrl } from "@/lib/place-thumb";
import type { RailOrg, RailScope } from "@/lib/rail-scope";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

type SidebarProps = {
  scope: RailScope;
  organizations: readonly RailOrg[];
  isSuperAdmin: boolean;
  /** The organizations could not be read. NOT the zero state: a fetch
   *  failure must never read "create one" (MESITA-1793's law). */
  viewerError: boolean;
  /** The signed-in email, or "Account" when the session carries none. It
   *  rides the Account row's tooltip (MESITA-1818, 2A): the row itself says
   *  "Account" — the page's name, not the longest string in the rail. */
  accountLabel: string;
  /** Where the switcher menus portal. The drawer passes ITSELF (an
   *  `aria-modal` surface must contain its own menus, MESITA-1818 9A); the
   *  desktop rail leaves it unset and the menus portal to the body. */
  menuContainer?: HTMLElement | null;
  /** Where the wordmark goes: the same landing `/` resolves to. */
  landingHref: string;
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
const CHIP =
  "bg-sidebar-accent text-foreground ring-sidebar-border flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ring-1";
const MENU_ITEM = "gap-2.5 rounded-lg py-1.5 text-[13px]";
// The org menu's rows are two lines (MESITA-1818, 7A): the name, then the
// role and count in 11px BENEATH it — a right-aligned meta ate a third of a
// 224px row and "Strana Del Valle", "… Norte" and "… Sur" all became
// "Strana Del Val…". Place rows carry no meta at all.
const MENU_STACK = "flex min-w-0 flex-1 flex-col leading-tight";
const MENU_META = "text-muted-foreground block truncate text-[11px] font-normal";
// The seam between two groups: the box's replacement. The same hairline the
// footer draws, inset to the row's own rect.
const SEAM = "border-sidebar-border my-1 border-t";
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

const VIEW_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: FileText,
  reviews: Star,
  activity: Activity,
  settings: Settings2,
  admin: Shield,
};

/** The rail's word for a view: the scope word is IN the label now that no
 *  eyebrow carries it (Pato: "I don't care word place is redundant"). The
 *  crumb and the heading keep the bare word — `PLACE_TAB_LABEL` is theirs.
 *  This string is the accessible name (title, tests); `PlaceRowLabel` is how
 *  it is painted. */
export function placeRowLabel(tab: PlaceTab): string {
  return `Place ${PLACE_TAB_LABEL[tab]}`;
}

/** Five rows begin with the same word, and people scan first words. The
 *  prefix is quieted by WEIGHT (400 against the noun's 500) at the row's own
 *  ink — never by alpha: 55% of muted ink over the sidebar ground is ~2.5:1,
 *  and 13px text needs 4.5:1 (MESITA-1818, 8A). Both spans take the row's
 *  hover and pill colors, so the pair never separates. */
function PlaceRowLabel({ tab }: { tab: PlaceTab }) {
  return (
    <>
      <span className="font-normal">Place </span>
      <span className="font-medium">{PLACE_TAB_LABEL[tab]}</span>
    </>
  );
}

/** A group boundary. `aria-hidden`: the groups are legible to a reader by
 *  their rows' names, and a hairline says nothing to it. */
function Seam({ collapsed }: { collapsed: boolean }) {
  return <div aria-hidden className={cn(SEAM, collapsed ? "mx-1.5" : "mx-2")} />;
}

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

function orgMeta(org: RailOrg): string {
  const n = org.places.length;
  return `${ROLE_LABEL[org.myRole]} · ${n === 1 ? "1 place" : `${n} places`}`;
}

function NavRow({
  href,
  label,
  labelNode,
  Icon,
  active,
  collapsed,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  /** The accessible name: the tooltip at `w-16`, the sr-only text. */
  label: string;
  /** How the label is painted when it is not just `label` (the quieted
   *  "Place " prefix). Never changes the accessible name. */
  labelNode?: React.ReactNode;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: GuardNav;
  title?: string;
}) {
  return (
    <Link
      href={href}
      {...HOVER_PREFETCH}
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
      // A given title wins at every width (the Account row's email); else
      // the label is the tooltip only where the label is not on screen.
      title={title ?? (collapsed ? label : undefined)}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>
        {collapsed ? label : (labelNode ?? label)}
      </span>
    </Link>
  );
}

/** A row that is a fact, not a link: the organizations could not be read. */
function MutedRow({
  label,
  Icon,
  collapsed,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  return (
    <div
      role="status"
      title={collapsed ? label : undefined}
      className={cn(
        ROW_BASE,
        "text-muted-foreground",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </div>
  );
}

/** The ceremony beside a picker: the ONE Plus component (MESITA-1800's
 *  split row, lifted out of the collection rows). Hidden at `w-16`: two
 *  targets do not fit, and the menu's footer carries the same door there.
 *  It TAKES THE PILL while you are inside its ceremony (MESITA-1818, 4A):
 *  Create organization is a page reached through this door, so on
 *  `/orgs/new` the ink lands here — one pill on every route, and the
 *  switcher beside it still never lit. */
function CeremonyPlus({
  href,
  label,
  active,
  collapsed,
  onNavigate,
  onGuardedNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  onGuardedNavigate?: GuardNav;
}) {
  if (collapsed) return null;
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      onClick={(e) => {
        if (!active) onGuardedNavigate?.(href, e);
        onNavigate?.();
      }}
      className={cn(
        "flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl transition lg:h-7 lg:min-h-0 lg:w-7",
        FOCUS_RING,
        active
          ? ROW_ACTIVE
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <Plus className={ICON} />
    </Link>
  );
}

/** The switcher: chip + name + up-down chevrons, a `DropdownMenuTrigger`.
 *  It is the control the group is named after ("Switch organization",
 *  "Switch place") and it never takes the pill. At `w-16` it is the chip
 *  alone and the menu opens to the right. With nothing to switch to it is a
 *  NAME: no chevron, same menu (MESITA-1818, 3A). */
function Picker({
  label,
  chip,
  name,
  switchable,
  muted = false,
  pending = false,
  collapsed,
  menuContainer,
  children,
}: {
  label: string;
  chip: React.ReactNode;
  name: string;
  /** Two or more to choose from. False renders no chevron. */
  switchable: boolean;
  /** Nothing to name yet (a pool place before its name publishes). */
  muted?: boolean;
  /** A choice was made and the route has not caught up yet. */
  pending?: boolean;
  collapsed: boolean;
  menuContainer?: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        aria-busy={pending || undefined}
        title={`${label}: ${name}`}
        className={cn(
          ROW_BASE,
          "w-full text-left",
          muted
            ? "text-muted-foreground"
            : "text-foreground font-semibold",
          "hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent",
          collapsed && "justify-center px-0 py-2",
        )}
      >
        {chip}
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
          {name}
        </span>
        {!collapsed && switchable && (
          <ChevronsUpDown
            aria-hidden
            className="text-muted-foreground h-3.5 w-3.5 shrink-0"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={collapsed ? "right" : "bottom"}
        sideOffset={4}
        container={menuContainer ?? undefined}
        className="w-72 motion-reduce:animate-none"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrgChip({ name }: { name: string }) {
  return (
    <span aria-hidden className={CHIP}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function PlaceChip({ place }: { place: RailPlace | null }) {
  const src = place ? placeThumbUrl(place.photoUrl, 20) : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a 20px thumb through the resizer; next/image's layout cost is not worth a rail chip
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className="ring-sidebar-border h-5 w-5 shrink-0 rounded-md object-cover ring-1"
      />
    );
  }
  return (
    <span aria-hidden className={CHIP}>
      <Store className="h-3 w-3" />
    </span>
  );
}

/** A footer door in a menu: a link, so the browser's own open-in-new-tab and
 *  copy-link work on it. */
function MenuLink({
  href,
  label,
  Icon,
  onNavigate,
  onGuardedNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  onNavigate?: () => void;
  onGuardedNavigate?: GuardNav;
}) {
  return (
    <DropdownMenuItem asChild className={cn(MENU_ITEM, "text-muted-foreground")}>
      <Link
        href={href}
        onClick={(e) => {
          onGuardedNavigate?.(href, e);
          onNavigate?.();
        }}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

export function Sidebar({
  scope,
  organizations,
  isSuperAdmin,
  viewerError,
  accountLabel,
  landingHref,
  menuContainer,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const guardNav = useOpenPlaceGuard();
  const openPlace = useOpenPlace();

  // A choice in a picker shows the CHOSEN name until the route catches up:
  // `router.push` takes a cross-region round trip, and a trigger that keeps
  // saying the old name for 300 ms reads as a click that did nothing. Set only
  // after the guard let the navigation through — a swallowed click opens the
  // discard dialog, and cancel has no callback, so an eager name would stick.
  // The choice remembers the pathname it was made on and counts only while
  // that is still the pathname: no effect, nothing to reset.
  const [choice, setChoice] = useState<{ id: string; at: string } | null>(null);
  const [, startTransition] = useTransition();
  const pendingId = choice && choice.at === pathname ? choice.id : null;

  const go = (href: string, id: string) => {
    if (guardNav?.(href)) return;
    setChoice({ id, at: pathname });
    startTransition(() => router.push(href));
    onNavigate?.();
  };

  const org = scope.org;
  const orgPage = orgPageFromPathname(pathname);
  const onOrgNew = pathname === SHELL_ROUTES.orgNew;
  const onAccount = pathname === SHELL_ROUTES.account;
  const currentView = placeTabFromPathname(pathname);

  // The Place box's subject: the pathname's place when it is held, the pool
  // place it names otherwise (name and views arrive by publish), else the
  // place remembered for this organization.
  const foreign =
    scope.foreignPlaceId !== null
      ? openPlace?.id === scope.foreignPlaceId
        ? openPlace
        : { id: scope.foreignPlaceId, name: "Place", tabs: ["profile"] as PlaceTab[] }
      : null;
  const placeTabs: PlaceTab[] = foreign
    ? foreign.tabs
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : org
        ? tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })
        : [];
  const placeSubjectId = foreign?.id ?? scope.place?.id ?? null;
  const viewIsHere = foreign !== null || scope.placeIsCurrent;

  const pickOrg = (id: string) => {
    if (id === org?.id) return;
    go(orgHref(id), id);
  };
  const pickPlace = (id: string) => {
    if (!org || id === scope.place?.id) return;
    // The same view on the new place when it may be opened there — comparing
    // two places' Activity is the whole reason to switch — else Profile.
    const allowed = tabsForAccess({ held: true, role: org.myRole, isSuperAdmin });
    const view = currentView && allowed.includes(currentView) ? currentView : "profile";
    go(placeTabHref(id, view), id);
  };

  const pendingOrg = pendingId ? organizations.find((o) => o.id === pendingId) : null;
  const pendingPlace = pendingId && org ? org.places.find((p) => p.id === pendingId) : null;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-4 pb-3">
      {/* THE TOP LINE: the product. Who you are is the first box below. */}
      <div
        className={cn(
          "flex shrink-0 items-center",
          collapsed ? "justify-center" : "px-1.5",
        )}
      >
        <Link
          href={landingHref}
          // Guarded like every other route out of here: the wordmark lands
          // where `/` would, and a place with unsaved edits asks first.
          onClick={(e) => {
            guardNav?.(landingHref, e);
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
        {/* The row says the page; the email is a fact about it (2A). */}
        <NavRow
          href={SHELL_ROUTES.account}
          label="Account"
          title={accountLabel === "Account" ? "Account" : `Account · ${accountLabel}`}
          Icon={UserRound}
          active={onAccount}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
        <Seam collapsed={collapsed} />

        {viewerError ? (
          <MutedRow
            label="Couldn't load organizations"
            Icon={AlertCircle}
            collapsed={collapsed}
          />
        ) : !org ? (
          <NavRow
            href={SHELL_ROUTES.orgNew}
            label="Create organization"
            Icon={Plus}
            active={onOrgNew}
            collapsed={collapsed}
            onNavigate={onNavigate}
            onGuardedNavigate={guardNav ?? undefined}
          />
        ) : (
          <>
            {/* The organization: its switcher, then its ONE page (MESITA-1810);
                the list and the Add place step beneath it light this same
                row — they are the organization's own steps. */}
            <div className="flex items-center gap-0.5">
              <Picker
                label="Switch organization"
                chip={<OrgChip name={pendingOrg?.name ?? org.name} />}
                name={pendingOrg?.name ?? org.name}
                switchable={organizations.length >= 2}
                pending={pendingOrg !== null && pendingOrg !== undefined}
                collapsed={collapsed}
                menuContainer={menuContainer}
              >
                {organizations.length === 1 ? (
                  <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
                    <OrgChip name={org.name} />
                    <span className={MENU_STACK}>
                      <span className="truncate">{org.name}</span>
                      <span className={MENU_META}>{orgMeta(org)}</span>
                    </span>
                  </DropdownMenuLabel>
                ) : (
                  <DropdownMenuRadioGroup value={org.id} onValueChange={pickOrg}>
                    {organizations.map((o) => (
                      <DropdownMenuRadioItem key={o.id} value={o.id} className={MENU_ITEM}>
                        <OrgChip name={o.name} />
                        <span className={MENU_STACK}>
                          <span className="truncate">{o.name}</span>
                          <span className={MENU_META}>{orgMeta(o)}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
                <DropdownMenuSeparator />
                <MenuLink
                  href={SHELL_ROUTES.orgNew}
                  label="Create organization"
                  Icon={Plus}
                  onNavigate={onNavigate}
                  onGuardedNavigate={guardNav ?? undefined}
                />
              </Picker>
              <CeremonyPlus
                href={SHELL_ROUTES.orgNew}
                label="Create organization"
                active={onOrgNew}
                collapsed={collapsed}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            </div>
            <NavRow
              href={orgHref(org.id)}
              label={ORG_PAGE_LABEL.overview}
              Icon={Building2}
              active={orgPage !== null}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onGuardedNavigate={guardNav ?? undefined}
            />
            <Seam collapsed={collapsed} />

            {/* THE PLACE GROUP. While an organization switch is pending the
                chosen org's name already shows above, so everything here is
                the OLD org's — stale for ~300ms warm, longer cold. It dims
                and ignores clicks until the route lands (5A); the pill does
                not move. Not motion, so reduced-motion keeps it. */}
            <div
              className={cn(
                "flex flex-col gap-0.5",
                pendingOrg && "pointer-events-none opacity-50",
              )}
            >
              {placeSubjectId === null ? (
                // The organization holds nothing yet: the next step, and only
                // the next step — for the role that may take it (6A). A
                // switcher with nothing to switch and five rows leading
                // nowhere would be a promise the rail cannot keep.
                canAddPlace(org.myRole) ? (
                  <NavRow
                    href={orgPlacesNewHref(org.id)}
                    label="Add place"
                    Icon={Plus}
                    active={false}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    onGuardedNavigate={guardNav ?? undefined}
                  />
                ) : null
              ) : (
                <>
                  <div className="flex items-center gap-0.5">
                    <Picker
                      label="Switch place"
                      chip={<PlaceChip place={pendingPlace ?? (foreign ? null : scope.place)} />}
                      name={pendingPlace?.name ?? foreign?.name ?? scope.place?.name ?? "Place"}
                      switchable={org.places.length >= 2 || foreign !== null}
                      muted={foreign !== null && foreign.name === "Place"}
                      pending={pendingPlace !== null && pendingPlace !== undefined}
                      collapsed={collapsed}
                      menuContainer={menuContainer}
                    >
                      {foreign && (
                        <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
                          <PlaceChip place={null} />
                          <span className={MENU_STACK}>
                            <span className="truncate">{foreign.name}</span>
                            <span className={MENU_META}>not held</span>
                          </span>
                        </DropdownMenuLabel>
                      )}
                      {foreign && org.places.length > 0 && <DropdownMenuSeparator />}
                      {org.places.length === 1 && !foreign ? (
                        <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
                          <PlaceChip place={org.places[0]} />
                          <span className="truncate">{org.places[0].name}</span>
                        </DropdownMenuLabel>
                      ) : org.places.length > 0 ? (
                        <DropdownMenuRadioGroup
                          value={foreign ? "" : (scope.place?.id ?? "")}
                          onValueChange={pickPlace}
                        >
                          {org.places.map((p) => (
                            <DropdownMenuRadioItem key={p.id} value={p.id} className={MENU_ITEM}>
                              <PlaceChip place={p} />
                              <span className="truncate">{p.name}</span>
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      ) : null}
                      <DropdownMenuSeparator />
                      <MenuLink
                        href={orgPlacesHref(org.id)}
                        label="All places"
                        Icon={Layers}
                        onNavigate={onNavigate}
                        onGuardedNavigate={guardNav ?? undefined}
                      />
                      {canAddPlace(org.myRole) && (
                        <MenuLink
                          href={orgPlacesNewHref(org.id)}
                          label="Add place"
                          Icon={Plus}
                          onNavigate={onNavigate}
                          onGuardedNavigate={guardNav ?? undefined}
                        />
                      )}
                    </Picker>
                    {canAddPlace(org.myRole) && (
                      <CeremonyPlus
                        href={orgPlacesNewHref(org.id)}
                        label="Add place"
                        active={false}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                        onGuardedNavigate={guardNav ?? undefined}
                      />
                    )}
                  </div>
                  {placeTabs.map((tab) => (
                    <NavRow
                      key={tab}
                      href={placeTabHref(placeSubjectId, tab)}
                      label={placeRowLabel(tab)}
                      labelNode={<PlaceRowLabel tab={tab} />}
                      Icon={VIEW_ICON[tab]}
                      active={viewIsHere && currentView === tab}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                      onGuardedNavigate={guardNav ?? undefined}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}
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
              <PanelLeftOpen className={ICON} />
            ) : (
              <PanelLeftClose className={ICON} />
            )}
            <span className={collapsed ? "sr-only" : "truncate"}>Collapse</span>
          </button>
        </div>
      )}
    </aside>
  );
}
