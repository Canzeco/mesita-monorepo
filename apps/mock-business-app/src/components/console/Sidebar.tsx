"use client";

// THE RAIL. One dark column, a head, one row shape, one list, a foot.
//
// ── THE SHAPE (MESITA-1905) ───────────────────────────────────────────────
//
//   ┌──────────────────┐
//   │  Mesita          │  the HEAD: the lockup, pinned, scrolls with nothing
//   ├──────────────────┤
//   │  Lumbre y Sal ⌄  │  the place this column is about
//   │  Home            │  where the console opens
//   │  Settings        │
//   │  …               │  the rows, and the only thing that scrolls
//   │                  │  the slack falls HERE, between the work and you
//   ├──────────────────┤
//   │  Account         │  the FOOT: the person, pinned
//   └──────────────────┘
//
// THE HEAD SAYS THE PRODUCT, THE FOOT SAYS THE PERSON, and the scroller
// between them says the business. Each band answers a different question, so
// none of them can be mistaken for a row of another's list — which is why the
// logo is NOT the first entry in `nav` and Account is NOT the last one.
//
// THE SLACK BELONGS TO THE MIDDLE. Account is pinned rather than trailing the
// rows, so a console with three rows and a console with eleven put the person
// in the same place. A footer that floats up under a short list is how an
// operator learns to hunt for their own name.
//
// ── THE LAWS IT KEEPS ──────────────────────────────────────────────────────
//
// ONE COLUMN, FROM ONE ARRAY. Every row comes from `RAIL_ROWS`; there is no
// second list anywhere. Moving a product is an edit to one line in
// lib/console-routes.ts, and the seams move with it because
// `RAIL_GROUP_STARTS` is derived, not typed beside it.
//
// ONE ROW SHAPE. No indent, one glyph, one label, no id, no count, no badge.
// The groups are unnamed SEAMS — they were headed once and the headers were
// deleted two issues later, because a column of eight rows under three titles
// is three lists.
//
// ROWS NEVER DIM. A product that is not live still gets a live row, and the
// PAGE says it is not here yet (SoonStrip). A dimmed row makes the column a
// place where some entries are real and some are not.
//
// ONE WIDTH. There is no chips-only rail and no control to reach one
// (MESITA-1905): Collapse was the only door to `w-16`, and a mode nobody can
// open is a second design to keep true for nothing. The rail is `w-60` on
// desktop and the drawer below `lg`.
//
// HIDDEN IS NOT PROTECTED. `tabsForAccess` drops rows a viewer may not see;
// `PlaceTabGate` is what actually refuses the address.
//
// THE DARK GROUND IS ITS OWN VOCABULARY. `--sidebar-*` only, including the
// focus ring: the page's `--ring` is the brand pink drawn against a light
// background, and the rail has `--sidebar-ring` for the same reason it has its
// own foreground. Do not unify them.
import { Fragment, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ChartNoAxesColumn,
  CreditCard,
  Gift,
  House,
  LayoutGrid,
  Plus,
  RotateCw,
  Settings,
  ShoppingBag,
  Store,
  Ticket,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  PLACE_PAGE_LABEL,
  RAIL_GROUP_STARTS,
  RAIL_ROWS,
  SHELL_ROUTES,
  flatPlacePageFromPathname,
  isPlaceHomePathname,
  placePageFromPathname,
  placePageHref,
  placeRootHref,
  productRowHref,
  type PlacePage,
} from "@/lib/console-routes";
import { PRODUCT_LABEL, type ProductKey } from "@/lib/product-keys";
import {
  PLACE_TAB_LABEL,
  placeTabFromPathname,
  placeTabHref,
  tabsForAccess,
  type PlaceTab,
} from "@/lib/place-tabs";
import { flatViewFromPathname } from "@/lib/console-routes";
import type { RailPlace, RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";
import { RailSelector } from "@/components/console/RailSelector";

const ICON = "h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5";

const ROW_BASE =
  "flex items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition min-h-11 lg:min-h-0 lg:py-2 lg:text-[13px] outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const ROW_REST =
  "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground";
// The active row is a SOLID pill, not a tint: on the dark rail it is the
// off-white fill with ink text — the brightest thing in the column, which is
// what makes "you are here" survive a glance down it.
const ROW_ACTIVE = "bg-sidebar-foreground text-sidebar font-semibold";
const SECTION_SEAM = "border-sidebar-border/50 mt-2 border-t pt-2";

// THE MARKS NAME THE SUBJECT, NOT THE LABEL:
//   Account   UserRound          the PERSON, one of them
//   Customers Users              PEOPLE, plural — the pairing IS the meaning
//   Products  LayoutGrid         the CATALOGUE: a grid of tiles, which is
//                                literally what the page is
//   Activity  ChartNoAxesColumn  counts over time; a squiggle reads medical
//   Profile   Store              the PLACE's public page, not a document
//   Home      House              the place's own front door
//
// HOME IS A HOUSE AND NOT THE FLAME (MESITA-1914). The consumer app's Home tab
// wears `MesitaMark` — it sits in a bottom nav with no lockup anywhere near it,
// so the flame is the only brand on that screen. Here the lockup is three rows
// above, and a 14px flame under a 20px flame reads as the same mark printed
// twice at two sizes rather than as a destination.
//
// The product rows wear the CATALOGUE's marks — one product with two different
// pictures is how an operator learns to distrust both. The tint does not come
// along: eight colours in one column is the thing that was ruled out.
const RAIL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  settings: Settings,
  products: LayoutGrid,
  activity: ChartNoAxesColumn,
  profile: Store,
  customers: Users,
  visits: Ticket,
  orders: ShoppingBag,
  reservations: CalendarCheck,
  rewards: Gift,
  pay: CreditCard,
  credits: Wallet,
  // The two views that lost their rows and kept their addresses.
};

const PAGE_ICON: Record<PlacePage, React.ComponentType<{ className?: string }>> = {
  settings: Settings,
  products: LayoutGrid,
  customers: Users,
  activity: ChartNoAxesColumn,
};

function NavRow({
  href,
  label,
  Icon,
  active,
  onNavigate,
  title,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  title?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // Only a GIVEN title renders one. The label is on screen at every width
      // this rail has, so a tooltip repeating it would be a second copy of the
      // row's own text.
      title={title}
      className={cn(ROW_BASE, active ? ROW_ACTIVE : ROW_REST)}
    >
      <Icon className={ICON} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** A row that is a FACT, not a link: the places could not be read. */
function MutedRow({
  label,
  Icon,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div role="status" className={cn(ROW_BASE, "text-sidebar-muted")}>
      <Icon className={ICON} />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function Sidebar({
  scope,
  places,
  isSuperAdmin,
  accountLabel,
  onNavigate,
  onPickPlace,
  onRetry,
}: {
  scope: RailScope;
  places: readonly RailPlace[];
  isSuperAdmin: boolean;
  accountLabel: string;
  onNavigate?: () => void;
  onPickPlace: (id: string) => void;
  onRetry: () => void;
}) {
  const pathname = usePathname();
  const placeId = scope.place?.id ?? null;

  const currentView: PlaceTab | null =
    placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);
  const currentPage: PlacePage | null =
    placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);

  const onAccount = pathname === SHELL_ROUTES.account;
  const onAddPlace = pathname === SHELL_ROUTES.placesNew;

  // WHICH ROWS THIS CALLER MAY SEE. The matrix is applied to the SELECTED
  // place's own role, so switching from a place you own to one you only view
  // drops six rows — which is the honest picture, not a bug.
  const allowed = useMemo(
    () =>
      new Set<PlaceTab>(
        tabsForAccess({
          held: scope.place !== null,
          role: scope.place?.myRole ?? null,
          isSuperAdmin,
        }),
      ),
    [scope.place, isSuperAdmin],
  );

  const viewHref = (tab: PlaceTab) => placeTabHref(placeId ?? "", tab);
  const pageHref = (page: PlacePage) => placePageHref(placeId ?? "", page);
  const opensGroup = (i: number) => RAIL_GROUP_STARTS.includes(i);

  // THE FOUR SHAPES. `unknown` is NOT `zero` with a sad face: it offers a
  // retry and never the word "add", because a failed read has not established
  // that the caller holds nothing.
  const showSelector = scope.mode === "solo" || scope.mode === "multi";
  const showRows = (scope.mode === "solo" || scope.mode === "multi") && placeId !== null;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      {/* THE HEAD. The lockup is a LABEL, not a link: every address this rail
          reaches is below it, and a logo that navigates somewhere would be a
          ninth destination wearing different clothes. It takes the rail's own
          foreground so it reads as part of the dark column rather than as a
          sticker on it, and it is inset by a row's own padding so its mark
          lines up with the glyph column underneath. */}
      <div className="flex shrink-0 items-center px-2.5 pt-1 pb-3">
        <MesitaLogo variant="horizontal" className="text-sidebar-foreground h-5 w-auto" />
      </div>

      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {scope.mode === "unknown" && (
          <>
            <MutedRow label="Places unavailable" Icon={Store} />
            <button
              type="button"
              onClick={onRetry}
              className={cn(ROW_BASE, ROW_REST, "w-full")}
            >
              <RotateCw className={ICON} />
              <span className="truncate">Try again</span>
            </button>
          </>
        )}

        {scope.mode === "zero" && (
          <NavRow
            href={SHELL_ROUTES.placesNew}
            label="Add your place"
            Icon={Plus}
            active={onAddPlace}
            onNavigate={onNavigate}
          />
        )}

        {showSelector && (
          <RailSelector current={scope.place} places={places} onPick={onPickPlace} />
        )}

        {/* MULTI WITH NOTHING SELECTED: the selector is up, and the rows are
            not — because every one of them would need a place id the console
            has correctly refused to guess. */}
        {showSelector && !showRows && (
          <NavRow
            href={SHELL_ROUTES.places}
            label="All places"
            Icon={LayoutGrid}
            active={pathname === SHELL_ROUTES.places}
            onNavigate={onNavigate}
          />
        )}

        {showRows &&
          RAIL_ROWS.map((row, i) => {
            if (row.kind === "product" && row.product !== "customers") {
              if (!allowed.has(row.product as PlaceTab)) return null;
            }
            const seam = opensGroup(i) ? SECTION_SEAM : undefined;
            const node =
              row.kind === "home" ? (
                // HOME HAS NO MATRIX ROW. `tabsForAccess` is a list of VIEWS,
                // and Home is not one — a viewer who may open this place at all
                // may see its front door, which prints only what the rows below
                // it would have printed anyway.
                <NavRow
                  href={placeRootHref(placeId ?? "")}
                  label="Home"
                  Icon={House}
                  active={isPlaceHomePathname(pathname)}
                  onNavigate={onNavigate}
                />
              ) : row.kind === "page" ? (
                <NavRow
                  href={pageHref(row.target)}
                  label={PLACE_PAGE_LABEL[row.target]}
                  Icon={PAGE_ICON[row.target]}
                  active={currentPage === row.target}
                  onNavigate={onNavigate}
                />
              ) : row.kind === "product" ? (
                <NavRow
                  href={productRowHref(row.product as ProductKey, placeId ?? "", viewHref)}
                  label={PRODUCT_LABEL[row.product]}
                  Icon={RAIL_ICON[row.product]}
                  active={
                    row.product === "customers"
                      ? currentPage === "customers"
                      : currentView === (row.product as PlaceTab)
                  }
                  onNavigate={onNavigate}
                />
              ) : (
                <NavRow
                  href={viewHref(row.view)}
                  label={PLACE_TAB_LABEL[row.view]}
                  Icon={RAIL_ICON[row.view]}
                  active={currentView === row.view}
                  onNavigate={onNavigate}
                />
              );
            const key =
              row.kind === "home"
                ? "home"
                : row.kind === "page"
                  ? `page:${row.target}`
                  : row.kind === "product"
                    ? `product:${row.product}`
                    : `place:${row.view}`;
            // THE SEAM IS A WRAPPER'S BORDER, NEVER A ROW'S — a row that grew a
            // rule would be a second row shape. A row with no seam gets no
            // wrapper either.
            return seam ? (
              <div key={key} className={seam}>
                {node}
              </div>
            ) : (
              <Fragment key={key}>{node}</Fragment>
            );
          })}
      </nav>

      {/* THE FOOT: the person, pinned, alone (MESITA-1905). Account used to
          trail the rows inside the scroller, which put it in a different place
          on every scope — and it shared the footer with Collapse, which made
          the rail's own control look like a destination. Now the band holds
          exactly one row and that row is you. It renders in every state,
          including the failed read: whatever went wrong with the places, the
          person is still signed in. */}
      <div className={cn(SECTION_SEAM, "shrink-0")}>
        <NavRow
          href={SHELL_ROUTES.account}
          label="Account"
          title={`Account · ${accountLabel}`}
          Icon={UserRound}
          active={onAccount}
          onNavigate={onNavigate}
        />
      </div>
    </aside>
  );
}
