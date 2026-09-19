"use client";

// THE MENU. A column again — lockup, venue, fifteen rows (MESITA-2004).
//
// ── THE SHAPE ──────────────────────────────────────────────────────────────
//
//   ┌────────────────────────┐
//   │  mesita.               │   the lockup, fixed, never scrolls
//   │  ┌──────────────────┐  │
//   │  │ 🏞  Lumbre y Sal │  │   the venue band — back from the rail
//   │  │    Mesita Pro    │  │
//   │  └──────────────────┘  │
//   │   📍 Place             │
//   │   📈 Activity          │   the place's WHOLE log
//   │   ⚙️ Settings          │
//   │   🤝 Plan     [Partner]│
//   │                        │
//   │   PRODUCTS             │
//   │   🏪 Mesita Profile    │
//   │   …ten of them…        │
//   │                        │
//   │   ROADMAP              │
//   │   🔮 Future products  9│
//   └────────────────────────┘
//
// ── WHY IT IS INK ──────────────────────────────────────────────────────────
//
// MESITA-1981 ruled the menu black and MESITA-1975's line carried that; the
// line is gone and the ruling is not, so the black moves into the column.
//
// THE COST MESITA-1981 PAID IS REFUNDED HERE. That issue put an ink bar above
// an ink AskBar band and wrote down that Home now had two ink surfaces
// separated only by shape. A column and a band do not stack: the menu is
// beside the page rather than above it, so the console is back to ONE dark
// object and the band is the only ink thing on Home again.
//
// IT PAINTS WITH `--dock-*` AND MAY NOT READ A PAGE TOKEN. `--dock` is
// `--ink`, not pure black; `text-muted-foreground` (#5d5d5d) is unreadable on
// it and `bg-foreground` is invisible. Rest is `--dock-muted` (white at 64%,
// 7.84:1 on the ink), hover is full white, the chosen row is `--dock-surface`
// (white at 10%, which composites to #2e2e2e — a 1.73:1 step you can see), and
// the focus ring is `--sidebar-ring`, which is pure white and exists for
// exactly this reason.
//
// PURE BLACK IS STILL RESERVED for `--mock-strip`, which sits directly above
// this column. Two identical black slabs read as chrome rather than as a
// warning, and the warning is the more important of the two.
//
// ── THE ACTIVE ROW IS A FILL, NOT A RULE ───────────────────────────────────
//
// MESITA-1975 argued a solid pill was a slab across a 1400px line and replaced
// it with a 2px underline. That argument was about a LINE. In a 252px column a
// fill is the rail's original idiom and it is the right one: an underline under
// one row in a stack of fifteen reads as a separator between two of them.
//
// ── ROWS ARE ABSENT, NEVER DIMMED ──────────────────────────────────────────
//
// `TopNav`'s law, inherited: *a destination a caller cannot reach is NOT
// RENDERED*. A viewer gets no products, so the whole Products group goes —
// label and all, because a heading over nothing is worse than neither. Hiding
// is not the gate; every page still refuses its own address.
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MesitaLogo } from "@/components/brand/MesitaLogo";
import { PlaceChip } from "@/components/console/PlaceChip";
import { Badge, ProductStateBadge } from "@/components/shared/Badges";
import { buildProductCards, type ProductCard } from "@/lib/products";
import { PRODUCT_MARK } from "@/lib/product-marks";
import type { ProductKey } from "@/lib/product-keys";
import {
  FUTURE_SLUG,
  PARTNERSHIP_SLUG,
  PRODUCT_SLUG,
  productHref,
} from "@/lib/product-routes";
import {
  SIDEBAR_GROUPS,
  SIDEBAR_LOG_LABEL,
  SIDEBAR_LOG_MARK,
  SIDEBAR_PLACE_LABEL,
  SIDEBAR_PLACE_MARK,
  SIDEBAR_PLAN_LABEL,
  SIDEBAR_PLAN_MARK,
  SIDEBAR_ROADMAP_LABEL,
  SIDEBAR_ROADMAP_MARK,
  SIDEBAR_SETTINGS_LABEL,
  SIDEBAR_SETTINGS_MARK,
  type SidebarRow,
} from "@/lib/sidebar-rows";
import {
  SHELL_ROUTES,
  isPlaceHomePathname,
  placePageHref,
  placePayHref,
} from "@/lib/console-routes";
import { pagesForAccess, placeTabHref } from "@/lib/place-tabs";
import { PLAN_LABEL, type MockPlace } from "@/mock/types";
import type { RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

/** 13px, the size the rail landed on after five passes (MESITA-1956 → 1958)
 *  and the size MESITA-2001 brought the top menu back down to. A nav label is
 *  a LABEL, not body copy, and it is the same size under a finger and a cursor.
 *
 *  `min-h-9` is 36px, not 44. The 44px target was a TOP BAR rule, where four
 *  tabs had a whole bar's height to spend; fifteen rows at 44px is 660px of
 *  column before the lockup and the venue. 36px with a 4px gap between rows
 *  keeps the touch slop the guideline is actually about, and the drawer — the
 *  only place these are touched — has the full width of the panel per row. */
const ROW =
  "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-inset";
const ROW_REST = "text-dock-muted hover:bg-dock-surface/70 hover:text-dock-foreground";
const ROW_ON = "bg-dock-surface text-dock-foreground font-semibold";

/** The mark's box. Fixed width so every name starts on the same x — a ragged
 *  left edge across fifteen rows is the thing that makes a list look generated. */
const MARK = "w-[18px] shrink-0 text-center text-[13px] leading-none";

const GROUP_LABEL =
  "px-2.5 pb-1.5 text-[9.5px] font-semibold tracking-[0.14em] text-white/45 uppercase";

export function Sidebar({
  scope,
  place,
  isSuperAdmin,
  onNavigate,
}: {
  scope: RailScope;
  /** THE WHOLE RECORD, not `scope.place`. `RailPlace` is a six-field `Pick`
   *  and `buildProductCards` reads far more than six — every `atPlace`
   *  predicate in `lib/products.ts` interrogates the place directly. `AppShell`
   *  looks it up in `world.places` by the id the scope resolved, so the scope
   *  is still the one thing deciding WHICH place, and this is only how much of
   *  it the menu can see. Null whenever the scope holds none. */
  place: MockPlace | null;
  isSuperAdmin: boolean;
  /** Fired on every row click. The drawer closes itself with this; the fixed
   *  column passes nothing, because there is nothing to close. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const placeId = place?.id ?? null;

  // WHICH ROWS THIS CALLER MAY SEE. `pagesForAccess` is the only filter, and it
  // is all-or-nothing: a viewer gets neither half, so a viewer gets no products
  // and no per-place log. Their menu is Place and Settings.
  const allowed = new Set(
    pagesForAccess({
      held: place !== null,
      role: place?.myRole ?? null,
      isSuperAdmin,
    }),
  );

  // THE PLACE-SCOPED ROWS NEED A PLACE TO POINT AT. At `unknown` and `zero`
  // there is none, so they are absent rather than dead — the same call the rail
  // made with `showRows` and the line made with `showPages`.
  const held =
    (scope.mode === "solo" || scope.mode === "multi") &&
    placeId !== null &&
    allowed.size > 0;

  const cards: ProductCard[] = place
    ? buildProductCards({
        plan: place.plan,
        mesitaPayEnabled: place.pay === "enabled",
        place,
        placeHref: (view) => placeTabHref(place.id, view),
        payHref: placePayHref(place.id),
      })
    : [];
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const soonCount = cards.filter((c) => c.state === "soon").length;

  const last = pathname.split("/").filter(Boolean).at(-1) ?? "";

  function render(row: SidebarRow): React.ReactNode {
    switch (row.kind) {
      case "place":
        // `/places`, THE PORTFOLIO. Place is the switcher, not a home
        // (MESITA-1976) — and it is the one row that renders at every mode,
        // because at `zero` it carries the Add door.
        return (
          <Row
            key="place"
            href={SHELL_ROUTES.places}
            mark={SIDEBAR_PLACE_MARK}
            name={SIDEBAR_PLACE_LABEL}
            on={
              pathname === SHELL_ROUTES.places ||
              pathname === SHELL_ROUTES.placesNew ||
              isPlaceHomePathname(pathname)
            }
            onNavigate={onNavigate}
          />
        );
      case "log":
        if (!held || !place) return null;
        return (
          <Row
            key="log"
            href={placePageHref(place.id, "activity")}
            mark={SIDEBAR_LOG_MARK}
            name={SIDEBAR_LOG_LABEL}
            on={last === "activity"}
            onNavigate={onNavigate}
          />
        );
      case "settings":
        // LAST-RESORT ROW. It renders at EVERY mode, including `unknown` and
        // `zero`, because Sign out lives on it and a console whose only exit
        // disappears behind a failed read is the defect MESITA-1937 named.
        return (
          <Row
            key="settings"
            href={SHELL_ROUTES.settings}
            mark={SIDEBAR_SETTINGS_MARK}
            name={SIDEBAR_SETTINGS_LABEL}
            on={pathname === SHELL_ROUTES.settings}
            onNavigate={onNavigate}
          />
        );
      case "plan":
        if (!held || !place) return null;
        return (
          <Row
            key="plan"
            href={productHref(place.id, "products", PARTNERSHIP_SLUG)}
            mark={SIDEBAR_PLAN_MARK}
            name={SIDEBAR_PLAN_LABEL}
            on={last === PARTNERSHIP_SLUG}
            badge={
              <Badge tone={place.partnered ? "gold" : "off"}>
                {place.partnered ? "Partner" : "Free"}
              </Badge>
            }
            onNavigate={onNavigate}
          />
        );
      case "product": {
        if (!held || !place) return null;
        const card = byKey.get(row.key);
        if (!card) return null;
        const slug = PRODUCT_SLUG[row.key];
        return (
          <Row
            key={row.key}
            href={productHref(place.id, "products", slug)}
            mark={PRODUCT_MARK[row.key as ProductKey]}
            name={card.name}
            // THE ROW STAYS LIT ON BOTH HALVES. `/activity/<slug>` is the same
            // product seen from its other side, not a different destination —
            // the tab pair inside the pane says which half you are on, and a
            // menu that went dark when you pressed that pair would be teaching
            // the operator that they had left the product.
            on={last === slug}
            badge={<ProductStateBadge state={card.state} />}
            onNavigate={onNavigate}
          />
        );
      }
      case "roadmap":
        // NO DOOR ONTO AN EMPTY LIST. When every product has shipped the count
        // is zero and the row — and with it the group's label — is gone.
        if (!held || !place || soonCount === 0) return null;
        return (
          <Row
            key="roadmap"
            href={productHref(place.id, "products", FUTURE_SLUG)}
            mark={SIDEBAR_ROADMAP_MARK}
            name={SIDEBAR_ROADMAP_LABEL}
            on={last === FUTURE_SLUG}
            badge={
              <span className="rounded-full bg-white/14 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {soonCount}
              </span>
            }
            onNavigate={onNavigate}
          />
        );
    }
  }

  return (
    <div className="bg-dock flex h-full min-h-0 flex-col">
      {/* THE LOCKUP IS A LABEL, NOT A LINK, and it is OUTSIDE the scroller.
          Every address this menu reaches is in the list below it, so a logo
          that navigated would be a sixteenth destination in different clothes —
          the rail and the line both made this call. Keeping it out of the
          scroller is what stops the brand sliding away on a short window. */}
      <div className="flex h-13 shrink-0 items-center px-4">
        <MesitaLogo
          variant="horizontal"
          className="text-dock-foreground h-[18px] w-auto"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {/* THE VENUE BAND IS BACK (MESITA-2004). MESITA-1975 deleted it because
            a LINE has no room for a photo and a name, and MESITA-1985 put the
            venue at the line's right end instead. The line is gone, so without
            this the console would never say which place it is pointed at — and
            the pages below it have had no heading of their own since
            MESITA-1985 took theirs away.

            IT IS A LABEL, NOT A LINK. Place, one row below, already opens the
            portfolio; a venue that navigated would be the same door drawn twice,
            which is exactly what MESITA-1918 deleted the selector caret for. */}
        {place && (
          <div className="bg-dock-surface mb-3 flex items-center gap-2.5 rounded-xl px-2.5 py-2">
            <PlaceChip photoUrl={place.photoUrl} size="menu" />
            <div className="min-w-0">
              <p className="text-dock-foreground truncate text-[12.5px] font-semibold">
                {place.name}
              </p>
              <p className="text-dock-muted truncate text-[10.5px]">
                {PLAN_LABEL[place.plan]}
                {place.partnered ? " · Partner" : ""}
              </p>
            </div>
          </div>
        )}

        <nav aria-label="Console" className="flex flex-col gap-3">
          {SIDEBAR_GROUPS.map((group) => {
            const rows = group.rows.map(render).filter(Boolean);
            // A GROUP WITH NO ROWS HAS NO LABEL EITHER. "Products" over empty
            // space is a promise the console is not keeping, and a viewer would
            // read it as a failed load rather than as a permission.
            if (rows.length === 0) return null;
            return (
              <div key={group.label ?? "root"}>
                {group.label && <p className={GROUP_LABEL}>{group.label}</p>}
                <div className="flex flex-col gap-0.5">{rows}</div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function Row({
  href,
  mark,
  name,
  on,
  badge,
  onNavigate,
}: {
  href: string;
  mark: string;
  name: string;
  on: boolean;
  badge?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      onClick={onNavigate}
      className={cn(ROW, on ? ROW_ON : ROW_REST)}
    >
      <span aria-hidden className={MARK}>
        {mark}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </Link>
  );
}
