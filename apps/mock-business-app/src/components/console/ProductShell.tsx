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
import { Badge } from "@/components/shared/Badges";
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

// THE ROW, macOS-SHAPED (MESITA-1985) — a mark, a name, a state, a selection,
// and nothing else. 34px tall because a settings index is scanned.
const ROW =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition";
const ROW_ON = "bg-foreground text-background";
const ROW_OFF = "hover:bg-foreground/[0.06]";

const STATE_WORD: Record<ProductCard["state"], string> = {
  free: "Free",
  enabled: "On",
  off: "Off",
  locked: "Locked",
  soon: "Soon",
};

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

  const row = (args: {
    href: string;
    chosen: boolean;
    mark: string;
    name: string;
    state: string;
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
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[17px] leading-none"
      >
        {args.mark}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
        {args.name}
      </span>
      <span
        className={cn(
          "shrink-0 text-[12px]",
          args.chosen ? "text-background/70" : "text-muted-foreground",
        )}
      >
        {args.state}
      </span>
    </Link>
  );

  const index = (
    <div className="flex flex-col gap-px">
      {/* THE PLAN IS THE FIRST ROW and is not one of the ten — it is what the
          ten are bought with. Not a `ProductKey`, and it must not become one. */}
      {row({
        href: productHref(place.id, half, PARTNERSHIP_SLUG),
        chosen: openSlug === PARTNERSHIP_SLUG,
        mark: "\u{1F91D}",
        name: "Plan",
        state: place.partnered ? "Partner" : "Free",
      })}
      {ten.map((card) =>
        row({
          key: card.key,
          href: productHref(place.id, half, PRODUCT_SLUG[card.key]),
          chosen: PRODUCT_SLUG[card.key] === openSlug,
          mark: PRODUCT_MARK[card.key],
          name: card.name,
          state: STATE_WORD[card.state],
        }),
      )}
      {/* ONE ROW FOR THE WHOLE ROADMAP. Its state word is a COUNT, not
          "Soon": the row is not a product with a state, it is a door onto a
          list, and a number is the one thing worth reading before opening
          it. */}
      {coming.length > 0 &&
        row({
          href: productHref(place.id, half, FUTURE_SLUG),
          chosen: openSlug === FUTURE_SLUG,
          mark: "\u{1F52E}",
          name: "Future products",
          state: String(coming.length),
        })}
    </div>
  );

  return (
    <div
      className={cn(
        SHELL_BLEED,
        "border-border grid border-t lg:h-[calc(100vh-9rem)] lg:grid-cols-3",
      )}
    >
      {/* THE INDEX — the page's own grey, one third, its own scroller. */}
      <div
        className={cn(
          "border-border lg:col-span-1 lg:min-h-0 lg:overflow-y-auto lg:border-r",
          open ? "hidden lg:block" : "block",
        )}
      >
        <div className={cn(SHELL_GUTTER, "flex flex-col gap-3 py-3")}>
          {index}
        </div>
      </div>

      {/* THE WORK SURFACE — white, two thirds, its own scroller; the page's
          grey under the two card grids (`PANE_ON_PAGE`). */}
      <div
        className={cn(
          paneOnPage ? "bg-background" : "bg-card",
          SHELL_GUTTER,
          "py-4 lg:col-span-2 lg:min-h-0 lg:overflow-y-auto",
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
