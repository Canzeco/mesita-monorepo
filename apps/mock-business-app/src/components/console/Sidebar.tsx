"use client";

// THE MENU. Apple's row anatomy on the ink column (MESITA-2004…2012, 2034).
//
// ── THE SHAPE ──────────────────────────────────────────────────────────────
//
//   ┌────────────────────────┐
//   │  mesita.               │   the lockup, fixed, never scrolls
//   │  ┌──────────────────┐  │
//   │  │ 🏞  Lumbre y Sal │  │   the venue band — back from the rail
//   │  │    Mesita Pro    │  │
//   │  └──────────────────┘  │
//   │   [📍] Place           │   32px row · 22px rounded-[6px] tile
//   │   [💳] Plan            │
//   │   [⚙️] Settings        │
//   │                        │   12px gap — NO caption rendered here
//   │  ▓[🏪] Mesita Profile  │  ← SELECTED: full white fill, ink text
//   │   [🤝] Partner Badge [On]│  the badge, not the purchase
//   │   …eight of them…      │
//   │   [🔮] Future products 10│  the eleventh row, a door
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
// 7.84:1 on the ink), hover is full white. THE SELECTED ROW IS `--dock-foreground`
// AT FULL OPACITY NOW (MESITA-2034), not the old 10% fill — see "THE ACTIVE ROW
// IS A FILL" below. The focus ring is real again, and it is split by state:
// `--dock-foreground` (white, inset) at rest, `--dock` (ink, inset) on the
// selected row — the OLD `--sidebar-ring` token was deleted in MESITA-1975 and
// every row rendered NO visible ring at all until this fix.
//
// PURE BLACK IS STILL RESERVED for `--mock-strip`, which sits directly above
// this column. Two identical black slabs read as chrome rather than as a
// warning, and the warning is the more important of the two.
//
// ── THE ACTIVE ROW IS A FILL, NOT A RULE — AND NOW IT INVERTS (MESITA-2034) ─
//
// MESITA-1975 argued a solid pill was a slab across a 1400px line and replaced
// it with a 2px underline. That argument was about a LINE. In a 320px column a
// fill is the rail's original idiom and it is the right one: an underline under
// one row in a stack of thirteen reads as a separator between two of them.
//
// Apple's selection is the loudest thing in its own sidebar; the achromatic
// translation of "accent fill" is the INVERSE — full `--dock-foreground` white,
// ink text — replacing the 10% `--dock-surface` fill this file used to draw
// (1.73:1, a step you could barely see). Every badge and the focus ring on
// that one row have to read the inversion too: badges pass `onDock={!on}` so
// the selected row's badges use the white-card tones, and the ring flips to
// `--dock` (ink) so it stays visible on white.
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
import { primaryHalf } from "@/lib/product-halves";
import { FUTURE_SLUG, PRODUCT_SLUG, productHref } from "@/lib/product-routes";
import {
  SIDEBAR_GROUPS,
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
  placePayHref,
  placePlanHref,
} from "@/lib/console-routes";
import { pagesForAccess, placeTabHref } from "@/lib/place-tabs";
import { PLAN_LABEL, type MockPlace } from "@/mock/types";
import type { RailScope } from "@/lib/rail-scope";
import { cn } from "@/lib/utils";

/** 13px, the size the rail landed on after five passes (MESITA-1956 → 1958)
 *  and the size MESITA-2001 brought the top menu back down to. A nav label is
 *  a LABEL, not body copy, and it is the same size under a finger and a cursor.
 *
 *  `min-h-8` IS 32PX, DOWN FROM 36 (MESITA-2034, Apple's row anatomy). Apple's
 *  own current guidance separately tables 32pt as an accepted SECONDARY
 *  control size — this is a documented trade, not the invented one MESITA-1956
 *  argued against at 44. Fifteen rows at 32 = 480px, so the drawer and the
 *  fixed column both fit a 812px phone with the lockup and venue band still
 *  on screen; the drawer — the only place these are touched — still has the
 *  full width of the panel per row, which is what keeps the touch slop real.
 *
 *  THE FOCUS RING IS SPLIT BY STATE, NOT SHARED. `ROW` used to carry
 *  `focus-visible:ring-sidebar-ring`, a token MESITA-1975 deleted — no
 *  `--color-sidebar-ring` exists in `@theme`, so every row and the drawer's
 *  hamburger rendered NO visible keyboard ring at all. `ROW_REST`'s ring is
 *  `--dock-foreground` (white, inset, visible on ink); `ROW_ON`'s is `--dock`
 *  (ink, inset, visible on the now-white selected fill) — the ring has to
 *  invert with the row or it goes invisible on exactly the row a keyboard
 *  user lands on most. */
const ROW =
  "flex min-h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition outline-hidden focus-visible:ring-2 focus-visible:ring-inset";
const ROW_REST =
  "text-dock-muted hover:bg-dock-surface/70 hover:text-dock-foreground focus-visible:ring-dock-foreground";
/** SELECTED ROW INVERTS (MESITA-2034). Apple's selection is the loudest thing
 *  in its sidebar; the achromatic translation of "accent fill" is the
 *  inverse, replacing the old 10% white fill (`bg-dock-surface`, 1.73:1) with
 *  a full white fill and ink text. Badges inside this row read `onDock=false`
 *  from the caller (they are on white now), and the focus ring flips to ink
 *  so it stays visible on the white fill. */
const ROW_ON = "bg-dock-foreground text-dock font-semibold focus-visible:ring-dock";

/** THE MARK'S TILE (MESITA-2034). 22px, `rounded-[6px]` — NOT `rounded-md`:
 *  at this token set `rounded-md` is `radius - 2px` = 12px, which on a 22px
 *  box rounds past the midpoint into a coin, not a tile. `bg-white/10` at
 *  rest, `bg-black/8` on the selected (white) row — the same luminance step
 *  `--dock-surface` already means, read against whichever ground the row is
 *  actually on. This is what makes a ragged emoji column read as Apple's icon
 *  column instead of a list of ungrouped glyphs. */
const MARK =
  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-white/10 text-center text-[13px] leading-none";
const MARK_ON = "bg-black/8";

/** THE COLUMN'S WIDTH, IN ONE PLACE. Pato, twice: *"make the menu wider."*
 *
 *  320px, up from the 272 MESITA-2010 shipped (itself up from 252). The rule
 *  MESITA-2004 wrote — a navigator is not content, so it is as wide as its
 *  longest name plus its badge and no wider — was read twice as the tightest
 *  width that merely FITS, and twice that produced a column Pato asked to
 *  widen. Fitting is the floor, not the target: at 272 "Online Reservations"
 *  and its `On` badge cleared each other by ~20px, which is a gap but not a
 *  margin. 320 leaves the longest row about a third of the column in air, so
 *  the names read as a list and the badges as a column beside it, and it is
 *  still narrower than any content pane it sits next to.
 *
 *  IT LIVES HERE BECAUSE `AppShell` RENDERS THE MENU TWICE — the fixed column
 *  above `lg` and the drawer panel below it. Two literals is the drift trap
 *  that file's own comment warns about: an edit lands on one copy and every
 *  gate stays green. */
export const SIDEBAR_WIDTH = "w-[320px]";

// THE `PRODUCTS` CAPTION STOPS RENDERING (MESITA-2034). Apple separates
// sidebar groups by gap alone, no label — a 12px gap under the venue band is
// the only boundary now. `group.label` is still a real string on
// `SidebarGroup` (`lib/sidebar-rows.ts`); it is wired to the group's own
// `aria-label` below rather than dropped, so a screen reader still hears
// "Products, group of ten" even though nothing sighted reads the word.

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
      case "plan":
        // THE PURCHASE, ON ITS OWN ROW AGAIN (MESITA-2012). It needs a place
        // to point at, so it is absent at `unknown` and `zero` — the same
        // call every place-scoped row makes. Unlike a product row it does NOT
        // read `allowed`: a viewer may see what the place pays, which is the
        // rule Settings' own Billing section already runs on, and the one
        // control that spends anything is owner-only inside the screen.
        if (!placeId || (scope.mode !== "solo" && scope.mode !== "multi"))
          return null;
        return (
          <Row
            key="plan"
            href={placePlanHref(placeId)}
            mark={SIDEBAR_PLAN_MARK}
            name={SIDEBAR_PLAN_LABEL}
            on={last === "plan"}
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
      // MESITA PARTNER IS STILL A PRODUCT ROW (MESITA-2011), drawn below with
      // the state badge every other product wears rather than its own
      // gold/off pair. The Plan row above it is a different destination, not
      // the one that issue folded in here — see MESITA-2012.
      case "product": {
        if (!held || !place) return null;
        const card = byKey.get(row.key);
        if (!card) return null;
        const slug = PRODUCT_SLUG[row.key];
        return (
          <Row
            key={row.key}
            // THE HALF THE PRODUCT HAS, not always Setup. Eight of the ten
            // open on their configuration; Prepaid Credits has no Setup half
            // since MESITA-2003 emptied it and Online Reputation has none at all
            // (MESITA-2011), so those two rows open the log rather than a 404.
            href={productHref(place.id, primaryHalf(row.key), slug)}
            mark={PRODUCT_MARK[row.key as ProductKey]}
            name={card.name}
            // THE ROW STAYS LIT ON BOTH HALVES. `/activity/<slug>` is the same
            // product seen from its other side, not a different destination —
            // the tab pair inside the pane says which half you are on, and a
            // menu that went dark when you pressed that pair would be teaching
            // the operator that they had left the product.
            on={last === slug}
            // `onDock={!on}` (MESITA-2034): three tones need the ink-column
            // variant now, not only `soon` — `live`/`gold` measured as low as
            // 1.3–1.8:1 on `--dock` (checked against the real oklch tokens),
            // not the "survive the ink rail unchanged" the tones' own old
            // comment claimed. The SELECTED row is white now (§8), so its
            // badge reads the white-card tone instead — `onDock` is false
            // exactly when the row it's drawn in has already inverted.
            badge={<ProductStateBadge state={card.state} onDock={!(last === slug)} />}
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
            // ROUTED THROUGH `Badge` NOW (MESITA-2034). This used to be a
            // hand-inlined `bg-white/14 text-white` span — white text on
            // white/14 composited over `--dock` measures 1.05:1, invisible on
            // the one row an operator can be standing on (the selected row is
            // white now too). `neutralDock` is this fact's ink-column tone;
            // `neutral` is what the selected (white) row reads instead.
            badge={
              <Badge tone={last === FUTURE_SLUG ? "neutral" : "neutralDock"}>
                {soonCount}
              </Badge>
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
              <div
                key={group.label ?? "root"}
                role={group.label ? "group" : undefined}
                aria-label={group.label ?? undefined}
                className="flex flex-col gap-0.5"
              >
                {rows}
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
      <span aria-hidden className={cn(MARK, on && MARK_ON)}>
        {mark}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {badge && <span className="shrink-0">{badge}</span>}
    </Link>
  );
}
