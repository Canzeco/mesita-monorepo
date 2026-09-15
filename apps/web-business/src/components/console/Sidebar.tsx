"use client";

// The whole navigation: THREE SECTIONS, each headed by a SELECTOR
// (MESITA-1848).
//
// Pato, 2026-09-14: *"better three sections"* —
//
//   [ ○ Account        ]  → /account                the person, no subitems
//   ─────────────────────
//   [ ▣ Organization ⌄ ]  which one you are in
//       Configuration     → /orgs/<id>/configuration
//       Products          → /orgs/<id>/products
//       Places            → /orgs/<id>/places
//       Customers         → /orgs/<id>/customers
//       Activity          → /orgs/<id>/activity
//   ─────────────────────
//   [ ⌂ Place        ⌄ ]  which one you are managing
//       Profile           → /places/<id>/profile
//       Menus             → /places/<id>/menus
//       Reviews           → /places/<id>/reviews
//       Capabilities      → /places/<id>/capabilities
//       Rewards           → /places/<id>/rewards
//       Admin             → /places/<id>/admin      super-admin only
//   ═════════════════════
//   ◧ Collapse            the rail's own control
//
// THE RAIL ANSWERS "WHICH" AND "WHERE" IN ONE COLUMN. It was a flat list of
// destinations, and a flat list cannot say which organization or which place
// those destinations are ABOUT — so the answer lived on a page (MESITA-1822),
// then on Account (MESITA-1832), then split in two (MESITA-1847). Heading each
// group with its own selector puts the scope question beside the pages it
// scopes, which is the only place it has ever belonged.
//
// ACCOUNT HAS NO SUBITEMS, so it is not a selector at all: there is one of
// you, and the row is simply a link to `/account`. Giving it a chevron would
// be a control with nothing to control.
//
// "KEEP IT STANDARD AND BORING." Pato, on the pass that made the rail flat:
// *"just standard spacing and design, don't use lots of fucking different
// styles in the same menu."* Two shapes now, and only two: a ROW (every
// destination, and Account) and a SELECTOR (the two subjects). The selector
// earns its difference by doing something no row does.
//
// ONE INDENT, ONE DEPTH. Every page sits under the selector it belongs to.
// What stays banned is everything that was only ever decoration — a tree
// line, a bullet, a box, a well, an eyebrow, a `role="group"` — and a SECOND
// depth, which is the point a rail becomes a file tree. At `w-16` nothing
// indents and each selector is its chip: there is no label to align to, and
// the accessible name rides `aria-label` at every width.
//
// NO ID IN ANYTHING THE OPERATOR READS. Every href carries one; none is shown.
//
// NO PLACE YET: the place rows stay, AT FULL STRENGTH (MESITA-1833); each
// opens the page, which answers with the one next step. The rail never
// shrinks. Zero organizations: Account and Create organization. A failed
// organizations read: Account and a muted line, never the create row
// (MESITA-1793's law).
//
// DARK (MESITA-1831). The rail sits on the brand's ink (`--sidebar` is the
// dock token, globals.css) and paints ONLY with `sidebar-*` tokens: rows at
// rest `text-sidebar-muted` (58% white), hover `bg-sidebar-accent` (white/10)
// + full white, the pill an off-white fill with ink text. A page token —
// `text-muted-foreground`, `bg-foreground` — is ink on ink here, and the
// source test refuses it. The selectors' MENUS are popovers over the page,
// not part of this column, so they keep the page's own tokens.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  ChartNoAxesColumn,
  Gift,
  Layers,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Shield,
  SlidersHorizontal,
  Star,
  Store,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MENU_CHIP,
  MENU_ITEM,
  MENU_META,
  MENU_MUTED,
  MENU_STACK,
  RailSelector,
  SELECTOR_CHIP,
} from "@/components/console/RailSelector";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { canAddPlace } from "@/lib/active-organization";
import { placeThumbUrl } from "@/lib/place-thumb";
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import {
  FLAT_ROUTES,
  ORG_RAIL_TARGETS,
  SHELL_ROUTES,
  flatOrgTargetFromPathname,
  flatViewFromPathname,
  orgHref,
  orgPlacesHref,
  orgPlacesNewHref,
  orgSwitchHref,
  orgTargetFromPathname,
  type OrgRailTarget,
} from "@/lib/console-routes";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import type { RailOrg, RailScope } from "@/lib/rail-scope";

type SidebarProps = {
  scope: RailScope;
  organizations: readonly RailOrg[];
  isSuperAdmin: boolean;
  /** The organizations could not be read. NOT the zero state: a fetch
   *  failure must never read "create one" (MESITA-1793's law). */
  viewerError: boolean;
  /** The signed-in email, or "Account" when the session carries none. It
   *  rides the Account row's tooltip: the row says "Account", the page's
   *  name, not the longest string in the rail. */
  accountLabel: string;
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
// THE ONE ROW SHAPE. Every row in the column is this and nothing else — the
// four nouns, the five views beneath Places, and Collapse. A second shape is
// the thing Pato threw out.
const ROW_BASE = cn(
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px]",
  FOCUS_RING,
);
const ROW_REST =
  "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";
// The active row is a SOLID pill, not a tint: on the dark rail it is the
// off-white fill with ink text — the brightest thing in the column, which is
// what makes "you are here" survive a glance down it.
const ROW_ACTIVE = "bg-sidebar-foreground text-sidebar font-semibold";
// THE ONE INDENT: the place's five, under the row they belong to. It is a
// left pad on the same row shape — not a wrapper, not a rule, not a bullet —
// so the five are still the same rows, moved. `twMerge` drops `px-2.5`'s left
// half in favour of this.
const ROW_INDENT = "pl-7 lg:pl-6";
// THE SECTION SEAM (MESITA-1851). Pato: *"maybe add bar like separating
// sections."* Each group opens with a hairline above its selector — the same
// rule the footer already draws over Collapse, at the same weight, so the
// column has one kind of divider and not two. MESITA-1849 made every row one
// height, which is what made air alone stop reading as a boundary: once
// nothing is taller than anything else, a 12px gap is just a gap.
//
// HALF THE DOCK BORDER (MESITA-1860). Pato: *"make the seams lighter."*
// `--sidebar-border` is 14% white — the right weight for the rail's own right
// edge against a light page, too loud for a divider inside the column, where
// the rows themselves sit at 58%. `/50` takes the same token to ~7%; the
// footer's seam moves with it, because two weights would be two dividers.
//
// The rule is the wrapper's own top border, so it spans the rail's full text
// column and needs no element of its own — and at `w-16` it still separates
// the chips, which is the width where the group names are gone entirely.
//
// ACCOUNT GETS NO RULE ABOVE IT. The rail carries no wordmark (MESITA-1842),
// so a seam over row one would separate the column from the window's edge.
const SECTION_SEAM = "border-sidebar-border/50 mt-2 border-t pt-2";
// The full route is prefetched on hover (MESITA-1779): the click then paints
// the body at once instead of the skeleton. The prop works at runtime in
// app/ and is missing from Link's public type, so it is spread in.
const HOVER_PREFETCH = { unstable_dynamicOnHover: true } as object;

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL (MESITA-1838, MESITA-1841, and
// MESITA-1844 for the row that arrived):
//
//   Account       UserRound           the PERSON, one of them
//   Organization  its own initial     the selector wears a brand chip, not an
//                                     icon: a NAME is what distinguishes one
//                                     organization from another, and an icon
//                                     would be identical on all of them
//   Configuration Building2           the organization's own record — the
//                                     ORGANIZATION, which is what the page is
//                                     about (MESITA-1853). A gear says
//                                     "preferences" and says it about nothing
//                                     in particular; the building says whose
//                                     record this is. The rename to
//                                     Configuration (MESITA-1852) does not
//                                     bring the gear back: the page is five
//                                     boxes ABOUT this organization, not a
//                                     preferences screen
//   Menus         UtensilsCrossed     what the place serves
//   Customers     Users               PEOPLE, plural, against Account's one —
//                                     the pairing IS the meaning: you, and
//                                     everyone who comes to you
//   Products      LayoutGrid          the CATALOGUE — a grid of tiles, which
//                                     is literally what the page is
//                                     (MESITA-1869). Wallet left with the
//                                     Payments row it belonged to
//   Activity      ChartNoAxesColumn   counts over time; a heart-rate squiggle
//                                     reads medical
//   Places        Layers              a stack of them, and the SAME mark the
//                                     Organization page's own Places door
//                                     wears — one subject, one glyph, on both
//                                     screens that offer it
//   Profile       Store               the PLACE's public page, not a document
//   Capabilities  SlidersHorizontal   the mark the page's own card wears; a
//                                     gear would say "settings", the name this
//                                     view stopped using
//   Rewards       Gift                what a guest gets back
//
// Reviews (Star) and Admin (Shield) are each already the conventional mark for
// their subject; swapping a correct icon to look busy is churn. Coins is gone
// from this app entirely: Credits has no row and no page of its own any more
// (MESITA-1845), only a dashed strip that carries no mark.

/** The rail's word for a view — the bare word, as in the drawing.
 *  `PLACE_TAB_LABEL` is the same word; this exists so the tests and the rail
 *  share one reader. */
export function placeRowLabel(tab: PlaceTab): string {
  return PLACE_TAB_LABEL[tab];
}

const ORG_ROW: Record<
  OrgRailTarget,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  configuration: { label: "Configuration", Icon: Building2 },
  products: { label: "Products", Icon: LayoutGrid },
  places: { label: "Places", Icon: Layers },
  customers: { label: "Customers", Icon: Users },
  activity: { label: "Activity", Icon: ChartNoAxesColumn },
};

const PLACE_ROW_ICON: Record<PlaceTab, React.ComponentType<{ className?: string }>> = {
  profile: Store,
  menus: UtensilsCrossed,
  reviews: Star,
  capabilities: SlidersHorizontal,
  rewards: Gift,
  admin: Shield,
};

/** The place's six, in the list's order. Admin is super-admin only. */
const PLACE_ROWS = [
  "profile",
  "menus",
  "reviews",
  "capabilities",
  "rewards",
  "admin",
] as const;

/** The selector's mark: the organization wears the brand, the place wears its
 *  own photo. Two kinds of thing, so they never look interchangeable — and at
 *  `w-16` the chip is the ONLY thing left identifying the subject. Its BOX is
 *  the row icon's box (SELECTOR_CHIP), so every mark in the column shares one
 *  left edge; only the fill differs.
 */

const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" } as const;

/** The line the trigger no longer prints (MESITA-1849): the role and the
 *  holding, on the menu row that actually compares one organization to the
 *  next. On the trigger it answered a question nobody had asked yet, at twice
 *  the height of a real destination. */
function orgMeta(org: RailOrg): string {
  const n = org.places.length;
  return `${ROLE_LABEL[org.myRole]} · ${n === 1 ? "1 place" : `${n} places`}`;
}

function OrgChip({ name, menu = false }: { name: string; menu?: boolean }) {
  return (
    <span
      aria-hidden
      className={menu ? MENU_CHIP : cn(SELECTOR_CHIP, "bg-brand font-display text-white")}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function PlaceChip({
  name,
  photoUrl,
  menu = false,
}: {
  name: string | null;
  photoUrl?: string | null;
  menu?: boolean;
}) {
  const px = menu ? 20 : 16;
  const src = placeThumbUrl(photoUrl ?? null, px);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a small thumb through the resizer; next/image's layout cost is not worth a chip
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        className={cn("object-cover", menu ? "h-5 w-5 shrink-0 rounded-md" : SELECTOR_CHIP)}
      />
    );
  }
  void name;
  return (
    <span
      aria-hidden
      className={menu ? MENU_CHIP : cn(SELECTOR_CHIP, "bg-sidebar-accent text-sidebar-muted")}
    >
      <Store className={menu ? "h-3 w-3" : "h-2.5 w-2.5"} />
    </span>
  );
}

function NavRow({
  href,
  label,
  Icon,
  active,
  collapsed,
  indent,
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  /** The accessible name: the tooltip at `w-16`, the sr-only text. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  /** One of the place's five, under Places. Never a second depth, and never
   *  at `w-16`, where there is no label to align to. */
  indent?: boolean;
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
        // Close the drawer either way: the discard dialog answers on the top
        // layer, and a drawer left open over the new page is the bug.
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      // A given title wins at every width (the Account row's email); else
      // the label is the tooltip only where the label is not on screen.
      title={title ?? (collapsed ? label : undefined)}
      className={cn(
        ROW_BASE,
        active ? ROW_ACTIVE : ROW_REST,
        indent && !collapsed && ROW_INDENT,
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
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
        "text-sidebar-muted",
        collapsed && "justify-center px-0 py-2",
      )}
    >
      <Icon className={ICON} />
      <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
    </div>
  );
}

export function Sidebar({
  scope,
  organizations,
  isSuperAdmin,
  viewerError,
  accountLabel,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const guardNav = useOpenPlaceGuard();
  const openPlace = useOpenPlace();
  // THE TRANSITION IS THE CLOCK (MESITA-1818): a chosen name shows only while
  // the push it started is in flight, so the rail never claims a scope the
  // server has not answered for yet.
  const [choice, setChoice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pendingId = isPending ? choice : null;

  const org = scope.org;
  const onOrgNew = pathname === SHELL_ROUTES.orgNew;
  // WHICH ORGANIZATION ADDRESS, by either spelling: the canonical
  // `/orgs/<id>[/<page>]` or the flat resolver still in flight. Both light the
  // same row — an operator who typed `/members` is on the Organization row,
  // because the Organization page is Members' door.
  const orgTarget =
    orgTargetFromPathname(pathname) ?? flatOrgTargetFromPathname(pathname);
  // ACCOUNT LIGHTS FOR ACCOUNT, AND NOTHING ELSE. Every organization ceremony
  // and every door-only page lights ORGANIZATION. A second pill is the failure
  // mode every rail test in this repo counts, and it arrives exactly this way:
  // one row keeping a clause after another row took the subject.
  const onAccount = pathname === SHELL_ROUTES.account;
  // The view you are on, whichever address you came by: the canonical
  // `/places/<id>/<view>` or the flat resolver still in flight (MESITA-1839).
  const currentView = placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);

  // Which views the selected place offers this viewer: the ONE matrix
  // (lib/place-tabs), from the published set when the place is on screen,
  // else from the viewer's role in the organization. A pool place: Profile
  // alone. No place: the held set — the pages answer with Add place.
  const foreign = scope.foreignPlaceId !== null;
  const placeTabs: PlaceTab[] = foreign
    ? (openPlace?.id === scope.foreignPlaceId ? openPlace.tabs : (["profile"] as PlaceTab[]))
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : org
        ? tabsForAccess({ held: true, role: org.myRole, isSuperAdmin })
        : [];
  const noPlace = org !== null && scope.place === null && !foreign;

  // WHERE A ROW POINTS (MESITA-1839). The canonical address names its
  // subject, and the shell has already resolved which subject that is — so the
  // rail links straight there and a click costs ONE hop. The flat address is
  // the fallback for the state where there is nothing to name yet: with no
  // place selected, `/profile` renders the next step (Add place) instead of
  // forwarding nowhere. Either way the row is a live link, never disabled
  // (MESITA-1833).
  const placeId = scope.place?.id ?? scope.foreignPlaceId ?? null;
  const viewRow = (tab: PlaceTab) =>
    placeId ? placeTabHref(placeId, tab) : FLAT_ROUTES[tab];

  const placeRows = PLACE_ROWS.filter((tab) =>
    tab === "admin" ? isSuperAdmin : true,
  ).filter((tab) => noPlace || placeTabs.includes(tab));

  // WHICH ROW A ROW LIGHTS FOR. Every organization address is a rail row
  // now (MESITA-1847: Members became content ON the Organization page rather
  // than an address behind it), so each row takes its own — except the create
  // ceremony, which has no organization to name yet and would otherwise light
  // nothing. Places also takes the Add place ceremony beneath its list.
  const orgRowActive = (target: OrgRailTarget) =>
    target === "configuration"
      ? orgTarget === "configuration" || onOrgNew
      : orgTarget === target;

  // Both selectors guard BEFORE they show a pending name: an operator must
  // not see the new scope while still sitting on the old one's unsaved edits.
  const go = (href: string, id: string) => {
    if (guardNav?.(href)) return;
    setChoice(id);
    startTransition(() => router.push(href));
  };
  // `/orgs/<id>/switch` is the forwarder — it writes the org cookie, clears
  // the place cookie and lands on the organization you picked. Every other
  // organization address is a PAGE, and a page cannot set a cookie in flight.
  const pickOrg = (id: string) => {
    if (org && id !== org.id)
      go(orgSwitchHref(id, orgHref(id, "configuration")), id);
  };
  const pickPlace = (id: string) => {
    if (id !== scope.place?.id) go(placeTabHref(id, "profile"), id);
  };

  const pendingOrg = pendingId
    ? (organizations.find((o) => o.id === pendingId) ?? null)
    : null;
  const pendingPlace =
    pendingId && org ? (org.places.find((p) => p.id === pendingId) ?? null) : null;
  const shownOrg = pendingOrg ?? org;
  // A place opened from the catalogue that no organization of the viewer's
  // holds: the pathname names it, only the layout's publish knows its name.
  const foreignName =
    foreign && openPlace?.id === scope.foreignPlaceId ? openPlace.name : null;
  const shownPlace = pendingPlace ?? scope.place;
  const placeName = shownPlace?.name ?? foreignName;
  const canAdd = org !== null && canAddPlace(org.myRole);

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {/* THE PERSON, FIRST (MESITA-1844). Before the navigation, not under
            it: the column reads who you are, what you run, how it is doing,
            where it happens. It is the one row every state renders. */}
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
            {/* ── THE ORGANIZATION: which one, then its pages ─────────── */}
            <div className={SECTION_SEAM}>
            <RailSelector
              label="Switch organization"
              name={shownOrg?.name ?? "Organization"}
              chip={<OrgChip name={shownOrg?.name ?? "?"} />}
              switchable={organizations.length >= 2}
              pending={pendingOrg !== null}
              collapsed={collapsed}
            >
              {organizations.length === 1 ? (
                <DropdownMenuLabel className={cn(MENU_ITEM, "flex items-center")}>
                  <OrgChip name={org.name} menu />
                  <span className={MENU_STACK}>
                    <span className="truncate">{org.name}</span>
                    <span className={MENU_META}>{orgMeta(org)}</span>
                  </span>
                </DropdownMenuLabel>
              ) : (
                <DropdownMenuRadioGroup value={org.id} onValueChange={pickOrg}>
                  {organizations.map((o) => (
                    <DropdownMenuRadioItem key={o.id} value={o.id} className={MENU_ITEM}>
                      <OrgChip name={o.name} menu />
                      <span className={MENU_STACK}>
                        <span className="truncate">{o.name}</span>
                        <span className={MENU_META}>{orgMeta(o)}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className={MENU_MUTED}>
                <Link
                  href={SHELL_ROUTES.orgNew}
                  onClick={(e) => guardNav?.(SHELL_ROUTES.orgNew, e)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create organization
                </Link>
              </DropdownMenuItem>
            </RailSelector>
            </div>
            {ORG_RAIL_TARGETS.map((target) => (
              <NavRow
                key={target}
                href={orgHref(org.id, target)}
                label={ORG_ROW[target].label}
                Icon={ORG_ROW[target].Icon}
                active={orgRowActive(target)}
                collapsed={collapsed}
                indent
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}

            {/* ── THE PLACE: which one, then its views ──────────────────── */}
            <div className={SECTION_SEAM}>
            <RailSelector
              label="Switch place"
              name={placeName ?? (canAdd ? "Add a place" : "No place yet")}
              chip={<PlaceChip name={placeName} photoUrl={shownPlace?.photoUrl} />}
              switchable={org.places.length >= 2}
              pending={pendingPlace !== null}
              collapsed={collapsed}
            >
              {org.places.length === 0 ? (
                <DropdownMenuLabel className={MENU_MUTED}>
                  {foreignName
                    ? "Not in your organizations"
                    : `${org.name} holds none yet`}
                </DropdownMenuLabel>
              ) : (
                <DropdownMenuRadioGroup
                  value={shownPlace?.id ?? ""}
                  onValueChange={pickPlace}
                >
                  {org.places.map((p) => (
                    <DropdownMenuRadioItem key={p.id} value={p.id} className={MENU_ITEM}>
                      <PlaceChip name={p.name} photoUrl={p.photoUrl} menu />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
              <DropdownMenuSeparator />
              {canAdd && (
                <DropdownMenuItem asChild className={MENU_MUTED}>
                  <Link
                    href={orgPlacesNewHref(org.id)}
                    onClick={(e) => guardNav?.(orgPlacesNewHref(org.id), e)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add place
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className={MENU_MUTED}>
                <Link
                  href={orgPlacesHref(org.id)}
                  onClick={(e) => guardNav?.(orgPlacesHref(org.id), e)}
                >
                  <Layers className="h-3.5 w-3.5" />
                  All places
                </Link>
              </DropdownMenuItem>
            </RailSelector>
            </div>
            {placeRows.map((tab) => (
              <NavRow
                key={tab}
                href={viewRow(tab)}
                label={placeRowLabel(tab)}
                Icon={PLACE_ROW_ICON[tab]}
                active={currentView === tab}
                collapsed={collapsed}
                indent
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            ))}
          </>
        )}
      </nav>

      {/* THE RAIL'S OWN CONTROL, pinned to the bottom and alone there. Account
          moved to row one (MESITA-1844), so the footer is one button under one
          seam, and the rail's empty space falls above it — which reads as room
          to spare rather than as a layout that failed. */}
      {onToggleCollapse && (
        <div className="border-sidebar-border/50 mt-2 flex shrink-0 flex-col gap-0.5 border-t pt-2">
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
