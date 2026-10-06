"use client";

// THE WORK SURFACE. What is left of the two-column shell (MESITA-2004).
//
// ── THE SETUP MEASURE (MESITA-2034, confirmed at 768px by Pato) ───────────
//
// Apple's own settings panes read at a measure, not a full window's width —
// the screenshot Pato sent had a control 1,400px from the label it acted on.
// `max-w-3xl` wraps CHILDREN only, never the ground div below: the ground
// still runs `SHELL_BLEED`/`SHELL_GUTTER` full-bleed to the window edge
// exactly as before, so this is a measured pane on a full-width ground, not
// a narrow card floating on a wide grey page.
//
// DERIVED FROM `half`, NOT AN OPT-IN PROP. This function already renders one
// div for BOTH Setup ("products") and Activity ("activity") halves; if the
// measure were a prop each of the twelve Setup call sites had to remember to
// pass, a thirteenth view could forget it — the exact silent-drift shape this
// whole redesign exists to close. Activity keeps its current fluid width with
// no per-view choice to get wrong.
//
// PROFILE IS EXEMPT UNTIL ITS OWN PR CONVERTS IT. `openKey` is already
// computed below for `PANE_ON_PAGE`; reusing it here means Profile's
// still-unconverted masonry grid does not get squeezed to 768px (and lose
// its grey ground — see `PANE_ON_PAGE`) before that PR lands. Whoever
// converts Profile removes `openKey !== "profile"` from this condition in
// the same commit that deletes `PANE_ON_PAGE`.
//
// ── WHAT LEFT ──────────────────────────────────────────────────────────────
//
// THE INDEX COLUMN. This file used to draw a 316px navigator — "Your plan", ten
// products, "Roadmap" — beside the pane, ONCE PER HALF. That is why the console
// listed every product twice: `/products` had one and `/activity` had an
// identical one, so going from an order's config to its orders meant a trip up
// to the menu, across, and back down the same twelve rows. The menu is the
// index now, it is drawn once, and it does not change underneath you when you
// switch halves. See `Sidebar.tsx`.
//
// THE MOBILE BACK LINK ("All products"). It existed because below `lg` the
// index and the pane were one screen at a time and the pane needed a way back
// to a list that was off-screen. The list is a drawer now and the hamburger is
// always on the bar, so a link that said "go back to the menu" would be the
// second control for a door that is already open.
//
// THE `lg:h-[calc(100vh-7rem)]` GRID. Two independent scrollers inside a fixed
// height was how the index scrolled without taking the pane with it. There is
// one scroller again — `main`, in `AppShell` — so this is just content.
//
// ── WHAT IS LEFT, AND WHY IT IS STILL A COMPONENT ──────────────────────────
//
// THE GATE. `pages.includes(half)` is the render-side half of the permission
// check, and it has to sit above every route under `products/` and `activity/`.
//
// THE GROUND. Most panes are a FORM and want white under them; Profile and
// Online Reputation are card grids and want the page's own grey, because a grid of
// white cards on white is a grid of hairlines (MESITA-1996). One bit, two
// values, and it has to be decided from the open slug — which is why this is a
// component and not a class name on a layout.
import { usePathname } from "next/navigation";
import { useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import type { ProductKey } from "@/lib/product-keys";
import { productFromSlug, type PlaceHalf } from "@/lib/product-routes";
import { SHELL_BLEED, SHELL_GUTTER } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** The one whose pane is a GRID OF CARDS rather than a form. It keeps the
 *  page's grey so the cards have something to lift off (MESITA-1996).
 *
 *  `reviews` LEFT THE SET WITH THE PRODUCT (MESITA-2007) and needed no
 *  replacement: the review boxes are Profile's Activity half now, and Profile
 *  was already here. Both of its halves are grids of white cards, so one entry
 *  covers the pair. */
const PANE_ON_PAGE: ReadonlySet<ProductKey> = new Set<ProductKey>(["profile"]);

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

  const last = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const openSlug = last === half ? null : last;
  const openKey = openSlug === null ? null : productFromSlug(openSlug);
  const paneOnPage = openKey !== null && PANE_ON_PAGE.has(openKey);
  const measured = half === "products" && openKey !== "profile";

  if (!place || !pages.includes(half)) return null;

  // FULL BLEED, then its own gutter. The pane's ground has to reach the edge of
  // the scroller or it reads as a card that failed to round its corners; the
  // gutter goes back on inside it so the content still lines up with every
  // other screen. `-mt-4 sm:-mt-8` cancels `AppShell`'s top padding for the
  // same reason — the surface starts at the top of the page, not 32px down it.
  return (
    <div
      className={cn(
        SHELL_BLEED,
        SHELL_GUTTER,
        // CANCEL THE SCROLLER'S PADDING AT BOTH ENDS, then add its own and
        // GROW. The surface has to start at the very top of the page and reach
        // the very bottom of it — a ground that stops short at either end is a
        // card nobody drew a border on.
        "-mt-4 -mb-4 grow py-4 sm:-mt-8 sm:-mb-8 sm:py-6",
        paneOnPage ? "bg-background" : "bg-card",
      )}
    >
      {measured ? <div className="max-w-3xl">{children}</div> : children}
    </div>
  );
}
