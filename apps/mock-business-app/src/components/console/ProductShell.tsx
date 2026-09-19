"use client";

// THE TWO-PANE SHELL, SHARED BY PRODUCTS AND ACTIVITY (MESITA-1986).
//
// Pato: *"I MEAN, A SYMMETRY MUST EXIST."*
//
// One component draws both surfaces. The index is the same products, in the
// same order with the same rows; only the addresses it links and the
// pane beside it change. Two hand-written indexes would be the same list
// maintained twice, and the second one would be a product behind within a week.
//
//   /places/<id>/products      · index + the default pane      · half="products"
//   /places/<id>/products/<p>  · index + that product's Manage
//   /places/<id>/activity     · index + the whole-place log · half="activity"
//   /places/<id>/activity/<p> · index + that product's Activity
//
// THE OPEN PRODUCT COMES FROM THE PATHNAME, not from a prop the layout cannot
// see: a Next layout does not receive its child's params, and reading the last
// segment here keeps the shell working for both `/products` (nothing open) and
// `/products/<slug>` without either route telling it anything.
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, ProductStateBadge } from "@/components/shared/Badges";
import { useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { buildProductCards, type ProductCard } from "@/lib/products";
import type { ProductKey } from "@/lib/product-keys";
import { PRODUCT_MARK } from "@/lib/product-marks";
import {
  FUTURE_SLUG,
  PARTNERSHIP_SLUG,
  PRODUCT_ORDER,
  PRODUCT_SLUG,
  productFromSlug,
  productHref,
  type PlaceHalf,
} from "@/lib/product-routes";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import {
  SHELL_BLEED,
  SHELL_GUTTER,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// THE INDEX IS ONE CARD OF ROWS (MESITA-2001), which is the shape this app
// already uses wherever a list of unlike things has to read as one scope —
// Account and Digital Presence both. Pato: *"the idea of a list is great, but
// the style of the list and the menu and the spacing and all the UI style is
// shit."*
//
// WHAT THE CARD FIXES THAT A BARE STACK DID NOT. The index was the only list
// in the console sitting directly on the page with no surface under it, while
// every other collection is white-on-grey (MESITA-1938). Twelve rows floating
// on the ground read as unfinished rather than as minimal. `divide-y` needs
// the rows to be DIRECT children, which is why nothing between the card and a
// row wraps them.
const CARD =
  "border-border bg-card divide-border w-full divide-y overflow-hidden rounded-2xl border";
const ROW = "flex w-full items-center gap-3 px-3 py-2.5 text-left transition";

// THE CHOSEN ROW IS THE PAGE SHOWING THROUGH THE CARD, NOT AN INK SLAB.
// `bg-foreground text-background` across a 660px column was the heaviest
// object on the screen — heavier than the ink menu above it — and hover
// painted a SECOND slab, so on any screen where the pointer was resting two
// rows read as picked at once. Both states are now steps of the same recessed
// grey, which is the vocabulary `--fill` already carries, and they can never
// be mistaken for each other because the chosen one also gains weight.
const ROW_ON = "bg-page";
const ROW_OFF = "hover:bg-page/55";

// THE MARK'S BOX, which is the whole reason the emoji work here. Pato asked
// for emoji twice and they are right — they cost the palette nothing and give
// a grey list its only life. What was wrong was that each one brought its own
// optical size: ⭐ filled its line box, 📅 rendered numerals nobody could read
// at 17px, 🌑 read as a rendering fault. A fixed 28px tile with the glyph
// centred in it makes every mark occupy the same square, so the column has one
// left edge instead of twelve.
//
// IT INVERTS ON THE CHOSEN ROW. The tile is the page grey inside a white card;
// on the chosen row the row IS that grey, so the tile takes the card's white
// instead. Same one step of contrast, pointing the other way.
const TILE =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] leading-none";

// A BAND LABEL NAMES A GROUP, IT DOES NOT SORT ONE. MESITA-1997 deleted
// RUNNING / COMING because splitting on `state` let the roadmap decide the
// order and the length of the console's own product list. These three do
// neither: `PRODUCT_ORDER` is still the order, the ten are still the ten, and
// the labels only say which of the three things you are looking at — what you
// pay with, what you run, and what is not here yet.
const GROUP_LABEL =
  "text-muted-foreground px-1 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase";

// THE TWO MARKS THAT ARE NOT IN `PRODUCT_MARK`, because neither row is a
// product: the Plan is what the products are bought with, and Future products
// is a door onto a list. Named here rather than inlined so the two callers of
// each — the row and nothing else, today — cannot drift into two glyphs.
const PLAN_MARK = "\u{1F91D}";
const FUTURE_MARK = "\u{1F52E}";

// NO GROUPS (MESITA-1997). The index used to split RUNNING / COMING on each
// card's `state`, which let the roadmap decide the order and the length of
// the console's own product list — nine unbuilt rows between an operator and
// the seven that work. Pato: *"i don't want a coming then shit."*
//
// It is `PRODUCT_ORDER` now — ten rows he chose, in the order he chose — and
// everything else is one FUTURE PRODUCTS row at the end. A product's state
// word still says Soon where it is Soon; what it no longer does is sort.

// THE GROUND UNDER THE PANE (MESITA-1996). Pato: *"make all the subpages white
// but mesita profile and online reviews."*
//
// Every pane is white — the work surface MESITA-1982 gave it — except the two
// that are CARD GRIDS. Profile is a masonry of editable cards under a
// completeness bar; Online Reviews is the three-box trio. A white card on a
// white pane is a hairline outline, and a dozen outlines read as a form ruled
// onto paper rather than as cards on a ground, so those two take the page's
// grey — the ground every card in this app already sits on (MESITA-1938). One
// column of tiles, one form, one dial or one stated absence, which is every
// other pane, is right on white.
//
// THE GROUND FOLLOWS THE PRODUCT, NOT THE SURFACE. Activity has been one
// screen on the page since MESITA-1988, so on that side these two already sit
// on the grey; this set is what makes the Products pane agree with it. Nothing
// else may read it — the shell is the one thing that paints the surface, and a
// view painting its own ground would be a grey box inset in the shell's
// padding.
const PANE_ON_PAGE: ReadonlySet<ProductKey> = new Set<ProductKey>([
  "profile",
  "reviews",
]);

export function ProductShell({
  half,
  children,
}: {
  half: PlaceHalf;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();

  // THE LAST SEGMENT IS THE OPEN PRODUCT, and only when it is not the surface
  // itself: `/places/<id>/products` ends in "products", which opens nothing.
  const last = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const openSlug = last === half ? null : last;
  const open = openSlug !== null;
  // The Partnership slug is not a product, so it resolves to null and stays
  // white with the rest.
  const openKey = openSlug === null ? null : productFromSlug(openSlug);
  const paneOnPage = openKey !== null && PANE_ON_PAGE.has(openKey);

  if (!place || !pages.includes(half)) return null;

  const cards = buildProductCards({
    plan: place.plan,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  });

  const byKey = new Map(cards.map((c) => [c.key, c]));
  /** The ten, in Pato's order. A key `buildProductCards` did not answer is
   *  skipped rather than rendered empty — the order is a list of names, and a
   *  name that no longer has a spec is a rename somebody has not finished. */
  const ten = PRODUCT_ORDER.map((k) => byKey.get(k)).filter(
    (c): c is ProductCard => c !== undefined,
  );
  /** THE COUNT ON THE FUTURE PRODUCTS ROW — how many are not built, which is
   *  what the row's NAME promises (MESITA-1999). It was "everything the ten
   *  leaves out", also nine, but nine of a different set: that one counted
   *  the live Developers Platform and skipped the unbuilt Express Website.
   *  The pane behind this row leads with `Coming next`, so the number beside
   *  the name has to be the size of that section or the row is counting one
   *  thing and the screen is showing another. */
  const coming = cards.filter((c) => c.state === "soon");

  /** ONE ROW. `state` is a NODE rather than a word because the three groups
   *  state three different kinds of fact — a rung, a product's state, a count
   *  — and a single string would have forced the two that are not a
   *  `ProductState` through a fake one. */
  const row = (args: {
    href: string;
    chosen: boolean;
    mark: string;
    name: string;
    state: React.ReactNode;
    key?: string;
  }) => (
    <Link
      key={args.key ?? args.href}
      href={args.href}
      aria-current={args.chosen ? "true" : undefined}
      className={cn(ROW, args.chosen ? ROW_ON : ROW_OFF)}
    >
      <span
        aria-hidden
        className={cn(TILE, args.chosen ? "bg-card" : "bg-page")}
      >
        {args.mark}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          args.chosen ? "font-semibold" : "font-medium",
        )}
      >
        {args.name}
      </span>
      <span className="shrink-0">{args.state}</span>
    </Link>
  );

  const index = (
    <>
      {/* THE PLAN IS ITS OWN CARD, not the first row of the products. It is
          not one of the ten and it must not become one — it is what the ten
          are bought with, and a band label is the cheapest way to say that
          without a sentence. */}
      <div>
        <p className={GROUP_LABEL}>Your plan</p>
        <div className={CARD}>
          {row({
            href: productHref(place.id, half, PARTNERSHIP_SLUG),
            chosen: openSlug === PARTNERSHIP_SLUG,
            mark: PLAN_MARK,
            name: "Plan",
            state: <PartnershipBadge partnered={place.partnered} />,
          })}
        </div>
      </div>

      <div>
        <p className={GROUP_LABEL}>Products</p>
        <div className={CARD}>
          {ten.map((card) =>
            row({
              key: card.key,
              href: productHref(place.id, half, PRODUCT_SLUG[card.key]),
              chosen: PRODUCT_SLUG[card.key] === openSlug,
              mark: PRODUCT_MARK[card.key],
              name: card.name,
              state: <ProductStateBadge state={card.state} />,
            }),
          )}
        </div>
      </div>

      {/* ONE ROW FOR THE WHOLE ROADMAP. Its state is a COUNT, not "Soon": the
          row is not a product with a state, it is a door onto a list, and a
          number is the one thing worth reading before opening it. That is
          also why it does not share the products card — a badge column with
          one bare number in it reads as a badge that failed to render. */}
      {coming.length > 0 && (
        <div>
          <p className={GROUP_LABEL}>Roadmap</p>
          <div className={CARD}>
            {row({
              href: productHref(place.id, half, FUTURE_SLUG),
              chosen: openSlug === FUTURE_SLUG,
              mark: FUTURE_MARK,
              name: "Future products",
              state: (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  {coming.length}
                </span>
              ),
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        SHELL_BLEED,
        // AND THE VERTICAL BLEED TOO (MESITA-2001). `SHELL_BLEED` only ever
        // cancelled the gutter, so main's own `py-4 sm:py-8` left a band of
        // bare page between the menu and this shell's top hairline — forty
        // empty pixels where MESITA-1985's heading used to be. The pair is
        // horizontal and vertical now, and the height below counts the same
        // rows: 28px strip + 52px menu + the 32px that is still under it.
        "-mt-4 sm:-mt-8",
        "border-border grid border-t lg:h-[calc(100vh-7rem)] lg:grid-cols-[316px_1fr]",
      )}
    >
      {/* THE INDEX — the page's own grey, A COLUMN, its own scroller.

          316px, NOT A THIRD OF THE WINDOW (MESITA-2001). `grid-cols-3` made
          the index as wide as the monitor was: on a 1980px window it drew a
          660px column holding a 34px row whose name was flush left and whose
          state was flush right, ~450px apart, twelve times. A navigator is
          not content — it does not get wider because there is room, it gets
          as wide as its longest name ("Online Reservations") plus its badge.
          The PANE keeps the rest, and the page itself stays fluid: this caps
          a column, not the console. */}
      <div
        className={cn(
          "border-border lg:min-h-0 lg:overflow-y-auto lg:border-r",
          open ? "hidden lg:block" : "block",
        )}
      >
        <div className={cn(SHELL_GUTTER, "flex flex-col gap-5 py-4")}>
          {index}
        </div>
      </div>

      {/* THE WORK SURFACE — white, EVERYTHING THE COLUMN IS NOT, its own
          scroller; the page's grey under the two card grids
          (`PANE_ON_PAGE`).

          NO `col-span` ON EITHER HALF (MESITA-2001). The grid was three equal
          columns with 1 + 2 spans across them; it is `[316px_1fr]` now, and a
          `col-span-2` left on the pane made it claim both tracks, which
          pushed it onto a second grid ROW under the index and gave it the
          full width of the window. Two tracks, two children, no spans — the
          spans were the three-column layout's and had to go with it. */}
      <div
        className={cn(
          paneOnPage ? "bg-background" : "bg-card",
          SHELL_GUTTER,
          "py-4 lg:min-h-0 lg:overflow-y-auto",
          open ? "block" : "hidden lg:block",
        )}
      >
        {/* THE WAY BACK IS MOBILE-ONLY: below `lg` the two halves are one
            screen at a time, and above it the index is already beside you. */}
        {open && (
          <Link
            href={`/places/${encodeURIComponent(place.id)}/${half}`}
            className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-[13px] font-medium lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All products
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

/** The partnership pane's badge, exported so the default Setup page and this
 *  index cannot disagree about the word. */
/** THE ROW'S STATE WORD. `Off` was right while the row was a partnership you
 *  either had or did not; a rung is never "off" — Free is a rung, with four
 *  products on it, and `free` is already in the grid's own vocabulary. */
export function PartnershipBadge({ partnered }: { partnered: boolean }) {
  return (
    <Badge tone={partnered ? "gold" : "off"}>
      {partnered ? "Partner" : "Free"}
    </Badge>
  );
}
