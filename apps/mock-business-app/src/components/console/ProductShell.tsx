"use client";

// THE TWO-PANE SHELL, SHARED BY PRODUCTS AND ACTIVITY (MESITA-1986).
//
// Pato: *"I MEAN, A SYMMETRY MUST EXIST."*
//
// One component draws both surfaces. The index is the same eighteen products
// in the same order with the same rows; only the addresses it links and the
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
import { buildProductCards, type ProductState } from "@/lib/products";
import { PRODUCT_MARK } from "@/lib/product-marks";
import {
  PARTNERSHIP_SLUG,
  PRODUCT_SLUG,
  productHref,
  type PlaceHalf,
} from "@/lib/product-routes";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import {
  SHELL_BLEED,
  SHELL_GUTTER,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// THE ROW, macOS-SHAPED (MESITA-1985) — a mark, a name, a state, a selection,
// and nothing else. 34px tall because a settings index is scanned.
const ROW =
  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition";
const ROW_ON = "bg-foreground text-background";
const ROW_OFF = "hover:bg-foreground/[0.06]";

const STATE_WORD: Record<ProductState, string> = {
  free: "Free",
  enabled: "On",
  off: "Off",
  locked: "Locked",
  soon: "Soon",
};

const GROUPS: { title: string; holds: (s: ProductState) => boolean }[] = [
  { title: "Running", holds: (s) => s !== "soon" },
  { title: "Coming", holds: (s) => s === "soon" },
];

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

  if (!place || !pages.includes(half)) return null;

  const cards = buildProductCards({
    partnered: place.partnered,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  });

  const index = (
    <>
      {GROUPS.map((group) => {
        const inGroup = cards.filter((c) => group.holds(c.state));
        if (inGroup.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-1">
            <h2 className={cn(TINY_LABEL_CLASS, "px-2 pt-2")}>{group.title}</h2>
            <div className="flex flex-col gap-px">
              {/* MESITA PARTNERSHIP, THE FIRST ROW OF RUNNING (MESITA-1982).
                  It is not a `ProductKey` and must not become one; it is a row
                  with an address like every other row. */}
              {group.title === "Running" && (
                <Link
                  href={productHref(place.id, half, PARTNERSHIP_SLUG)}
                  aria-current={openSlug === PARTNERSHIP_SLUG ? "true" : undefined}
                  className={cn(
                    ROW,
                    openSlug === PARTNERSHIP_SLUG ? ROW_ON : ROW_OFF,
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[17px] leading-none"
                  >
                    {"\u{1F91D}"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    Mesita Partnership
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[12px]",
                      openSlug === PARTNERSHIP_SLUG
                        ? "text-background/70"
                        : "text-muted-foreground",
                    )}
                  >
                    {place.partnered ? "Partner" : "Off"}
                  </span>
                </Link>
              )}

              {inGroup.map((card) => {
                const slug = PRODUCT_SLUG[card.key];
                const chosen = slug === openSlug;
                return (
                  <Link
                    key={card.key}
                    href={productHref(place.id, half, slug)}
                    aria-current={chosen ? "true" : undefined}
                    className={cn(ROW, chosen ? ROW_ON : ROW_OFF)}
                  >
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center text-[17px] leading-none"
                    >
                      {PRODUCT_MARK[card.key]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                      {card.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[12px]",
                        chosen ? "text-background/70" : "text-muted-foreground",
                      )}
                    >
                      {STATE_WORD[card.state]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
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

      {/* THE WORK SURFACE — white, two thirds, its own scroller. */}
      <div
        className={cn(
          "bg-card",
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
export function PartnershipBadge({ partnered }: { partnered: boolean }) {
  return (
    <Badge tone={partnered ? "gold" : "off"}>
      {partnered ? "Partner" : "Off"}
    </Badge>
  );
}
