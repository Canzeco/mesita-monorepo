"use client";

// The whole navigation: ONE FLAT COLUMN (MESITA-1879) IN THREE BANDS
// (MESITA-1909).
//
//   ▲ Mesita            the HEAD: the lockup, pinned, a label — not a link
//   ═════════════════════
//   ▣ Lumbre y Sal ⌄    the place this column is about
//   ⚙ Settings          → /places/<id>/settings     the team: members, keys
//   ▁ Activity          → /places/<id>/activity
//   ▦ Products          → /places/<id>/products     the catalogue
//   ⌂ Profile           → /places/<id>/profile
//   👥 Customers        → /places/<id>/customers
//   … the five remaining products
//                       the SLACK falls here, between the work and you
//   ═════════════════════
//   ○ Account           → /account   the FOOT: the person, pinned, alone
//
// THE HEAD SAYS THE PRODUCT, THE FOOT SAYS THE PERSON, and the scroller
// between them says the business. Each band answers a different question, so
// none can be mistaken for an entry in another's list — which is why the logo
// is not the first row of `nav` and Account is not its last. Account is PINNED
// rather than trailing the rows, so it sits in the same place under a viewer's
// three rows as under an owner's eleven.
//
// ONE WIDTH. There is no chips-only rail and no control to reach one: Collapse
// was the only door to `w-16`, and a mode nobody can open is a second design
// kept true for nothing. `w-60` on desktop, the drawer below `lg`.
//
// EVERY ROW IS ABOUT THE ONE PLACE (MESITA-1892). Three of them used to be an
// organization's addresses and the column said so nowhere — because an
// operator holding exactly one place had no question the word "Organization"
// answered. Pato, 2026-09-15: *"You can now only manage one place for
// organization … so hidden keep the org and place it. but i only see it like
// simpler."* The layer is not hidden any more, it is gone: `partnered`,
// `legal_name`, `rfc`, the Stripe account and the members all live on `places`
// now, so Settings, Activity, Products and Customers are the place's own
// pages at the place's own address. No row moved and no seam moved.
//
// THE ROW LIST LIVES IN `lib/console-routes.ts` AS `RAIL_ROWS`, once. This
// file renders it and never restates it — two lists is how the rail came to
// mean three different things in one document.
//
// ACCOUNT MOVED TO THE FOOT, below the seam. It is the person, not the
// business, and it is the one row every state renders.
//
// WHAT LOST ITS ROW AND KEPT ITS ADDRESS: Capabilities and Rewards (reached
// from the product cards that already link into the place), the catalogue
// (Add place and the zero-place empty state), Admin (typed, super-admin only).
// Hiding a row changes NOTHING about access — `tabsForAccess` is still the one
// matrix and `PlaceTabGate` still 404s a withheld tab.
//
// "KEEP IT STANDARD AND BORING." Pato, on the pass that made the rail flat:
// *"just standard spacing and design, don't use lots of fucking different
// styles in the same menu."* Two shapes now, and only two: a ROW (every
// destination, and Account) and a SELECTOR (the one subject). The selector
// earns its difference by doing something no row does.
//
// ONE INDENT, ONE DEPTH. What stays banned is everything that was only ever
// decoration — a tree line, a bullet, a box, a well, an eyebrow, a
// `role="group"` — and a SECOND depth, which is the point a rail becomes a
// file tree. At `w-16` nothing indents and the selector is its chip: there is
// no label to align to, and the accessible name rides `aria-label` at every
// width.
//
// NO ID IN ANYTHING THE OPERATOR READS. Every href carries one; none is shown.
//
// FOUR SHAPES, ONE COLUMN (`RailScope.mode`):
//
//   unknown  the places read FAILED. A muted retry line, never a count and
//            never the add row (MESITA-1793's law). An empty array is a
//            DIFFERENT fact and gets a different screen.
//   zero     a successful read of no places. Add place and Account, and the
//            page carries the one next step. Production holds zero places, so
//            this is every fresh environment, not an edge case. The rows
//            themselves are `ZERO_PLACE_ROWS`, which is now empty: every row
//            in this column names a place, and there is not one yet.
//   solo     the eleven rows. What this console is for.
//   multi    two or more. The rows still render for the place the ADDRESS
//            names; when nothing names one, the console does not choose — a
//            place picked for you is an edit against the wrong venue, and
//            nothing on screen would say so.
//
// DARK (MESITA-1831). The rail sits on the brand's ink (`--sidebar` is the
// dock token, globals.css) and paints ONLY with `sidebar-*` tokens: rows at
// rest `text-sidebar-muted` (58% white), hover `bg-sidebar-accent` (white/10)
// + full white, the pill an off-white fill with ink text. A page token —
// `text-muted-foreground`, `bg-foreground` — is ink on ink here, and the
// source test refuses it. The selector's MENU is a popover over the page, not
// part of this column, so it keeps the page's own tokens.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  CalendarCheck,
  ChartNoAxesColumn,
  CreditCard,
  Gift,
  Layers,
  LayoutGrid,
  Plus,
  Settings,
  ShoppingBag,
  Star,
  Store,
  Ticket,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import {
  MENU_CHIP,
  MENU_EMPTY,
  MENU_ITEM,
  MENU_MUTED,
  MenuSearch,
  RailSelector,
  SELECTOR_CHIP,
} from "@/components/console/RailSelector";
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PLACE_SEARCH_MIN, filterPlaces } from "@/lib/place-search";
import { placeThumbUrl } from "@/lib/place-thumb";
import { useOpenPlace, useOpenPlaceGuard, type GuardNav } from "@/components/console/OpenPlace";
import {
  FLAT_ROUTES,
  RAIL_GROUP_STARTS,
  RAIL_ROWS,
  SHELL_ROUTES,
  ZERO_PLACE_ROWS,
  flatPlacePageFromPathname,
  flatViewFromPathname,
  placePageFromPathname,
  placePageHref,
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
import type { RailPlace, RailScope } from "@/lib/rail-scope";

type SidebarProps = {
  scope: RailScope;
  places: readonly RailPlace[];
  isSuperAdmin: boolean;
  /** The places could not be read. NOT the zero state: a fetch failure must
   *  never read "add one" (MESITA-1793's law). */
  viewerError: boolean;
  /** The signed-in email, or "Account" when the session carries none. It
   *  rides the Account row's tooltip: the row says "Account", the page's
   *  name, not the longest string in the rail. */
  accountLabel: string;
  /** Closes the mobile drawer on navigation. Absent on the desktop rail. */
  onNavigate?: () => void;
};

// Focus travels through this rail on Tab, so the ring is the brand's, not the
// browser's: a themed ring is the cheapest tell that a surface was designed.
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
// THE ONE ROW SHAPE. Every row in the column is this and nothing else. A
// second shape is the thing Pato threw out.
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
// THE SECTION SEAM (MESITA-1851). Pato: *"maybe add bar like separating
// sections."* Each group opens with a hairline — the same rule the footer
// already draws over Collapse, at the same weight, so the column has one kind
// of divider and not two. MESITA-1849 made every row one height, which is what
// made air alone stop reading as a boundary: once nothing is taller than
// anything else, a 12px gap is just a gap.
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
// ROW ONE GETS NO RULE ABOVE IT. The rail carries no wordmark (MESITA-1842),
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
//   Place         its own photo       the selector wears the venue's picture:
//                                     a PHOTO is what distinguishes one place
//                                     from another, and an icon would be
//                                     identical on all of them
//   Settings      Settings            THE GEAR (MESITA-1871). Pato: *"use to
//                                     normal settings icon."* The page holds
//                                     two boxes (Members, Developers), and the
//                                     conventional mark is the honest one —
//                                     Reviews and Admin are the precedent:
//                                     take the convention when it is right
//   Menus         UtensilsCrossed     what the place serves
//   Customers     Users               PEOPLE, plural, against Account's one —
//                                     the pairing IS the meaning: you, and
//                                     everyone who comes to you
//   Products      LayoutGrid          the CATALOGUE — a grid of tiles, which
//                                     is literally what the page is
//   Activity      ChartNoAxesColumn   counts over time; a heart-rate squiggle
//                                     reads medical
//   Places        Layers              a stack of them — the catalogue's own
//                                     mark, on the menu door that opens it
//   Profile       Store               the PLACE's public page, not a document
//
// Reviews (Star) and Admin (Shield) are each already the conventional mark for
// their subject; swapping a correct icon to look busy is churn.

/** The rail's word for a view — the bare word, as in the drawing.
 *  `PLACE_TAB_LABEL` is the same word; this exists so the tests and the rail
 *  share one reader. */
export function placeRowLabel(tab: PlaceTab): string {
  return PLACE_TAB_LABEL[tab];
}

const PAGE_ROW: Record<
  PlacePage,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  settings: { label: "Settings", Icon: Settings },
  products: { label: "Products", Icon: LayoutGrid },
  customers: { label: "Customers", Icon: Users },
  activity: { label: "Activity", Icon: ChartNoAxesColumn },
};

/** The rail's mark for a row, by subject. `RAIL_ROWS` decides WHICH rows and
 *  in what order (lib/console-routes); this decides what each one wears.
 *
 *  THE PRODUCT ROWS WEAR THE CATALOGUE'S MARKS (MESITA-1885) — the same glyph
 *  the card carries in `ProductCatalog.tsx`, because a row and a card naming
 *  one product with two different pictures is how an operator learns to
 *  distrust both. The TINT does not come along: a rail row is one glyph on the
 *  sidebar's own dark surface, and eight colours in a column is the "lots of
 *  fucking different styles in the same menu" Pato ruled out in MESITA-1845. */
const RAIL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  settings: Settings,
  products: LayoutGrid,
  activity: ChartNoAxesColumn,
  // The eight, in PRODUCT_KEYS order.
  profile: Store,
  customers: Users,
  visits: Ticket,
  orders: ShoppingBag,
  reservations: CalendarCheck,
  rewards: Gift,
  pay: CreditCard,
  credits: Wallet,
  // Kept for the two views that lost their rows and not their addresses: the
  // place heading and the flat resolvers still read this table.
  menus: UtensilsCrossed,
  reviews: Star,
};

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
  onNavigate,
  onGuardedNavigate,
  title,
}: {
  href: string;
  /** The row's visible text, and its accessible name. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
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
      // Only a GIVEN title renders one — the Account row's email. The label is
      // on screen at every width this rail has, so a tooltip repeating it
      // would be a second copy of the row's own text.
      title={title}
      className={cn(ROW_BASE, active ? ROW_ACTIVE : ROW_REST)}
    >
      <Icon className={ICON} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** A row that is a fact, not a link: the places could not be read. */
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
  viewerError,
  accountLabel,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const guardNav = useOpenPlaceGuard();
  const openPlace = useOpenPlace();
  // THE TRANSITION IS THE CLOCK (MESITA-1818): a chosen name shows only while
  // the push it started is in flight, so the rail never claims a scope the
  // server has not answered for yet.
  const [choice, setChoice] = useState<string | null>(null);
  // THE PICKER'S FILTER (MESITA-1803), and it is inert below
  // `PLACE_SEARCH_MIN` places: the state exists, nothing reads it, no field
  // renders. The query is the rail's because the menu unmounts on close and
  // would otherwise forget mid-choice.
  const [placeQuery, setPlaceQuery] = useState("");
  const placeSearchRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const pendingId = isPending ? choice : null;

  // WHICH PAGE, by either spelling: the canonical `/places/<id>/<page>` or the
  // flat resolver still in flight. Both light the same row — an operator who
  // typed `/members` is on the Settings row, because Settings is Members'
  // door.
  const placePage =
    placePageFromPathname(pathname) ?? flatPlacePageFromPathname(pathname);
  // ACCOUNT LIGHTS FOR ACCOUNT, AND NOTHING ELSE. A second pill is the failure
  // mode every rail test in this repo counts, and it arrives exactly this way:
  // one row keeping a clause after another row took the subject.
  const onAccount = pathname === SHELL_ROUTES.account;
  const onAddPlace = pathname === SHELL_ROUTES.placesNew;
  // The view you are on, whichever address you came by: the canonical
  // `/places/<id>/<view>` or the flat resolver still in flight (MESITA-1839).
  const currentView = placeTabFromPathname(pathname) ?? flatViewFromPathname(pathname);

  // Which views the selected place offers this viewer: the ONE matrix
  // (lib/place-tabs), from the published set when the place is on screen,
  // else from the viewer's role on it. A pool place: Profile alone. No place:
  // the held set — the pages answer with Add place.
  const foreign = scope.foreignPlaceId !== null;
  const placeTabs: PlaceTab[] = foreign
    ? (openPlace?.id === scope.foreignPlaceId ? openPlace.tabs : (["profile"] as PlaceTab[]))
    : openPlace && scope.placeIsCurrent && openPlace.id === scope.place?.id
      ? openPlace.tabs
      : tabsForAccess({
          held: true,
          role: scope.place?.myRole ?? null,
          isSuperAdmin,
        });
  const noPlace = scope.place === null && !foreign;

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
  const pageRow = (page: PlacePage) =>
    placeId ? placePageHref(placeId, page) : FLAT_ROUTES[page];

  // WHICH ROWS. `RAIL_ROWS` is the whole vocabulary; three filters narrow it
  // and none invents a row:
  //
  //   zero        the FILTER `ZERO_PLACE_ROWS`, which is empty — every row
  //               names a place and there is not one yet. Not a second array.
  //   foreign     a place the caller does not hold shows Profile and nothing
  //               else: its pages are about a venue that is not theirs.
  //   role/matrix a place view the viewer may not open is not listed. Same
  //               `tabsForAccess` the place layout gates on, so the rail and
  //               the gate cannot disagree.
  //
  // A PRODUCT ROW IS FILTERED BY THE TAB IT OPENS (MESITA-1885), not by being
  // a product: seven of the eight are place views, so an editor-only switch
  // must not be listed for a viewer. Customers is a place PAGE, so it answers
  // from the page filter instead of a matrix it is not in — it is the only one
  // left since Terminal's sub-page went with Terminal (MESITA-1900).
  const productListed = (product: ProductKey) =>
    product === "customers"
      ? !foreign
      : noPlace || placeTabs.includes(product as PlaceTab);
  const rows = (scope.mode === "zero" ? ZERO_PLACE_ROWS : RAIL_ROWS).filter((r) =>
    r.kind === "page"
      ? !foreign
      : r.kind === "product"
        ? productListed(r.product)
        : noPlace || placeTabs.includes(r.view),
  );
  /** The seam falls above a row that OPENS a group, and only while the row
   *  before it survived the filter — a hairline under nothing is a rule that
   *  outlived its rows. Recomputed against the filtered list for that reason,
   *  never read off `RAIL_GROUP_STARTS` directly. */
  const opensGroup = (i: number): boolean => {
    if (i === 0) return false;
    const full = RAIL_ROWS.indexOf(rows[i]);
    return RAIL_GROUP_STARTS.includes(full);
  };

  // WHICH PRODUCT ROW LIGHTS (MESITA-1885). One of the eight does not open a
  // place view, so it answers from the space its address is actually in — and
  // `products` itself must NOT light for it, or the catalogue row and a
  // product row would be on together.
  const productRowActive = (product: ProductKey) => {
    if (product === "customers") return placePage === "customers";
    return currentView === (product as PlaceTab);
  };

  // The selector guards BEFORE it shows a pending name: an operator must not
  // see the new place while still sitting on the old one's unsaved edits.
  const go = (href: string, id: string) => {
    if (guardNav?.(href)) return;
    setChoice(id);
    startTransition(() => router.push(href));
  };
  const pickPlace = (id: string) => {
    if (id !== scope.place?.id) go(placeTabHref(id, "profile"), id);
  };
  // EVERY CLOSE ENDS THE NARROWING, not just the one that picks a place.
  // Clearing inside `pickPlace` covered a single route out of four: Escape, a
  // click outside and the trigger itself all left the query standing, and the
  // next open was a menu already filtered by a word typed minutes ago with
  // nothing on screen to say so.
  const closePlaceMenu = (open: boolean) => {
    if (!open) setPlaceQuery("");
  };
  // ESCAPE, IN TWO STAGES, AND ONLY FROM HERE. Radix's dismiss listener is on
  // the document in the capture phase, so the field's own handler never sees
  // the key; `DismissableLayer` calls this first and honours a
  // `preventDefault()`. A non-empty query absorbs Escape and clears; an empty
  // one — which is every state below PLACE_SEARCH_MIN, where no field renders
  // at all — falls through and the menu closes, as it always did.
  const escapePlaceMenu = (e: KeyboardEvent) => {
    if (placeQuery !== "") {
      e.preventDefault();
      setPlaceQuery("");
    }
  };
  // A LIST LONG ENOUGH TO NEED A FIELD, and the rows left after one is typed.
  // The threshold is read, never retyped (lib/place-search.ts).
  // MESITA-1892: there is no holder above the place, so the list the menu
  // searches is the caller's own portfolio — the same `places` every other
  // branch here reads, not an organization's holding.
  const placeSearch = places.length >= PLACE_SEARCH_MIN;
  const shownPlaces = placeSearch
    ? filterPlaces(places, placeQuery)
    : places;

  const pendingPlace = pendingId
    ? (places.find((p) => p.id === pendingId) ?? null)
    : null;
  // A place opened from the catalogue that the caller holds no membership on:
  // the pathname names it, only the layout's publish knows its name.
  const foreignName =
    foreign && openPlace?.id === scope.foreignPlaceId ? openPlace.name : null;
  const shownPlace = pendingPlace ?? scope.place;
  const placeName = shownPlace?.name ?? foreignName;

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-full flex-col overflow-hidden border-r px-2 pt-3 pb-3">
      {/* THE HEAD (MESITA-1909). The lockup is a LABEL, not a link: every
          address this rail reaches is below it, and a logo that navigated
          somewhere would be a destination wearing different clothes — and one
          the guard could not cover, since it is not a NavRow. It takes the
          rail's own foreground so it reads as part of the dark column rather
          than as a sticker on it, and it is inset by a row's own padding so the
          mark lines up with the glyph column underneath.

          MESITA-1842 deleted this on *"no mesita logo, fuck it"* and the shape
          that replaced it grew a head again anyway — the place selector
          (MESITA-1899). Two nouns stacked is what Pato asked for on 2026-09-16
          after seeing it in the mock: the product, then the venue. The mobile
          topbar is NOT part of this and keeps its scope line: what belongs
          above a CLOSED drawer is the thing the drawer is hiding. */}
      <div className="flex shrink-0 items-center px-2.5 pt-1 pb-3">
        <MesitaLogo variant="horizontal" className="text-sidebar-foreground h-5 w-auto" />
      </div>

      <nav
        aria-label="Console"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain"
      >
        {viewerError ? (
          // THE READ FAILED, and that is not the zero state. A count here
          // would be a claim about the operator's business that nothing
          // supports, and "Add place" would be a lie (MESITA-1793's law).
          <MutedRow
            label="Couldn't load your places"
            Icon={AlertCircle}
          />
        ) : (
          <>
            {/* THE SELECTOR IS THE RAIL'S HEAD, at one place or many
                (MESITA-1899). It rendered only at `multi` until now, on the
                reasoning that a control over one thing selects nothing
                (MESITA-1879) — which was true while the ORGANIZATION selector
                sat above it and gave the column a head regardless. MESITA-1892
                deleted that selector with the layer, so for every operator
                this console actually has (exactly one place) the rail opened
                cold on Settings, naming nothing it was about. Pato, 2026-09-16:
                *"where do you select the place"* → *"always show the place
                selector"*.

                At `solo` the control is a HEADER that happens to open: the
                venue's photo and name, and a menu holding that one place plus
                the All places footer — which is also how a solo operator
                reaches the catalogue without typing an address. */}
            {(scope.mode === "solo" || scope.mode === "multi") && (
              // ONE PLACE OR MANY. The console does not choose for you at
              // `multi` — the selector names which venue these rows are about,
              // and says "Pick a place" while nothing does. A row lighting
              // under an unnamed place would be lying about what is being
              // edited. At `solo` the name is never null, so that fallback is
              // the multi-only branch it reads as.
              //
              // `zero` and `unknown` stay out, for opposite reasons: `zero`
              // has no place to name and keeps the Add ceremony below, and
              // `unknown` means the read FAILED — naming a place we never read
              // would be a fabrication, which is the one thing the rail's
              // empty states exist to avoid.
              <div className="mb-1">
                <RailSelector
                  label="Switch place"
                  name={placeName ?? "Pick a place"}
                  chip={<PlaceChip name={placeName} photoUrl={shownPlace?.photoUrl} />}
                  switchable
                  pending={pendingPlace !== null}
                  autoFocusRef={placeSearch ? placeSearchRef : undefined}
                  onOpenChange={closePlaceMenu}
                  onEscapeKeyDown={escapePlaceMenu}
                >
                  {/* ABOVE THE GROUP, NEVER INSIDE IT (MESITA-1803): a field
                      inside a radio group is announced as one of the choices.
                      It appears only past PLACE_SEARCH_MIN places; below
                      that this menu is exactly what it was. */}
                  {placeSearch && (
                    <MenuSearch
                      value={placeQuery}
                      onChange={setPlaceQuery}
                      placeholder="Search places"
                      inputRef={placeSearchRef}
                    />
                  )}
                  <DropdownMenuRadioGroup
                    value={shownPlace?.id ?? ""}
                    onValueChange={pickPlace}
                  >
                    {shownPlaces.map((p) => (
                      <DropdownMenuRadioItem key={p.id} value={p.id} className={MENU_ITEM}>
                        <PlaceChip name={p.name} photoUrl={p.photoUrl} menu />
                        <span className="truncate">{p.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  {placeSearch && shownPlaces.length === 0 && (
                    <p className={MENU_EMPTY}>No places match.</p>
                  )}
                  {/* The footer is OUTSIDE the filter, always: when nothing
                      matches it is the only way out of the menu. */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className={MENU_MUTED}>
                    <Link
                      href={SHELL_ROUTES.places}
                      onClick={(e) => guardNav?.(SHELL_ROUTES.places, e)}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      All places
                    </Link>
                  </DropdownMenuItem>
                </RailSelector>
              </div>
            )}
            {scope.mode === "zero" && (
              // THE ONE CEREMONY THAT EARNS A ROW, and only while it is the
              // only thing to do. Every other ceremony lives on the page it
              // belongs to; with no place at all there is no page to put this
              // one on, and the rail would otherwise be empty above Account.
              //
              // NO ROLE GATE ANY MORE (MESITA-1892). It was owner-of-the-
              // organization, and `claim_place(p_place_id, p_claimer)` mints
              // the claimer's own owner row — there is no membership to hold
              // before you hold the place.
              <NavRow
                href={SHELL_ROUTES.placesNew}
                label="Add your place"
                Icon={Plus}
                active={onAddPlace}
                onNavigate={onNavigate}
                onGuardedNavigate={guardNav ?? undefined}
              />
            )}
            {rows.map((row, i) => {
              // PATO'S BLANK LINES, as hairlines. The rail's groups carry no
              // NAMES — MESITA-1842 headed them and MESITA-1844 deleted the
              // headers two issues later — so a group opens with the same seam
              // Account already wears and nothing else.
              const seam = opensGroup(i) ? SECTION_SEAM : undefined;
              const common = {
                onNavigate,
                onGuardedNavigate: guardNav ?? undefined,
              };
              const node =
                row.kind === "page" ? (
                  <NavRow
                    href={pageRow(row.target)}
                    label={PAGE_ROW[row.target].label}
                    Icon={PAGE_ROW[row.target].Icon}
                    active={placePage === row.target}
                    {...common}
                  />
                ) : row.kind === "product" ? (
                  <NavRow
                    href={productRowHref(row.product, placeId ?? "", viewRow)}
                    label={PRODUCT_LABEL[row.product]}
                    Icon={RAIL_ICON[row.product]}
                    active={productRowActive(row.product)}
                    {...common}
                  />
                ) : (
                  <NavRow
                    href={viewRow(row.view)}
                    label={placeRowLabel(row.view)}
                    Icon={RAIL_ICON[row.view]}
                    active={currentView === row.view}
                    {...common}
                  />
                );
              const key =
                row.kind === "page"
                  ? `page:${row.target}`
                  : row.kind === "product"
                    ? `product:${row.product}`
                    : `place:${row.view}`;
              // THE SEAM IS A WRAPPER'S BORDER, NEVER A ROW'S — a row that
              // grew a rule would be a second row shape. A row with no seam
              // gets NO wrapper either: an empty div per row is depth the
              // column does not need, and this file's own depth test counts
              // it.
              return seam ? (
                <div key={key} className={seam}>
                  {node}
                </div>
              ) : (
                <Fragment key={key}>{node}</Fragment>
              );
            })}
          </>
        )}
        {/* THE PERSON, LAST (MESITA-1879). Above the rail's own control and
            below one seam: the column reads the business top to bottom, then
            you. It renders in every state, including the failed read. */}
      </nav>

      {/* THE FOOT (MESITA-1909): the person, pinned, ALONE. Account trailed the
          rows inside the scroller, which put it in a different place on every
          scope — low under a partner owner's eleven rows, high under a viewer's
          three — and the footer belonged to Collapse, which made the rail's own
          control look like a destination. Now the band holds exactly one row
          and that row is you, so the rail's slack falls between the work and
          you rather than below a control.

          It renders in every state, INCLUDING the failed read: whatever went
          wrong with the places, the person is still signed in. It is still
          guarded — leaving a dirty place by this row asks first, like any
          other. */}
      <div className={cn(SECTION_SEAM, "shrink-0")}>
        <NavRow
          href={SHELL_ROUTES.account}
          label="Account"
          title={accountLabel === "Account" ? "Account" : `Account · ${accountLabel}`}
          Icon={UserRound}
          active={onAccount}
          onNavigate={onNavigate}
          onGuardedNavigate={guardNav ?? undefined}
        />
      </div>
    </aside>
  );
}
