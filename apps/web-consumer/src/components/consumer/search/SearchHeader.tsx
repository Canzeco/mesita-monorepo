"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape):
//
//   ( ⌖ ) [ ⚲ Search places…  ] ( ✦ )   one white band …
//   ─────────────────── hairline ──────────────────────
//   (⌖ Nearby) (☆ Popular) │ (○ Coffee) (○ Breakfast) …   … one hairline under
//   ─────────────────── map ───────────────────────────
//
// The bar's row: the locate disc, the query bar, the Ask AI pill (→ Search ›
// Chat, Soon) — two equal 36px discs around the bar (Pato, MESITA-2433: "location
// must be kinda symmetrical to ask ai"). One token set for every control lives
// in header-classes.ts. Under it one horizontal chip row: Nearby and Popular, a hairline,
// then every family, each with its line icon (Pato, MESITA-2426: they replaced
// All; MESITA-2478: line icons, not emoji — "emojis uses color and that
// takes attention"). ONE pick at a time: Near is every family ranked Near, Popular every
// family ranked Popular, a family is that family ranked Near. Sent as the
// server-side `familyKeys` and `prefer` (MESITA-2425). There is no Filters disc and no sheet (Pato,
// MESITA-2417: "Its just all and thats it"); the Google reviews minimum is
// the operator's, Admin › Discovery › Area.
//
// ONE SOLID WHITE BAND for the bar's row and the chip row, like Home's
// header and the bottom bar (Pato, MESITA-2413; MESITA-2469 merged the grey
// chip band of MESITA-2462 back in). Solid, never translucent (MESITA-2462:
// "i don't like a transparent scrolling at all"); the controls are grey
// fills, so white-on-white (MESITA-2450) cannot happen. Nothing floats on
// the map. Every
// control is h-9: the discs, the bar and every chip (MESITA-2445). `children`
// (the bar's results, the load error) COVER the chip row and run on over the
// map (`absolute top-0` on the chip band's box; Pato, MESITA-2417: "the searchbar
// results must cover the categories").

import type { ReactNode } from "react";
import Link from "next/link";
import { BotMessageSquare } from "lucide-react";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import { FamilyIcon } from "@/lib/family-icons";
import {
  clearMapFamilies,
  selectMapFamily,
  useMapFilters,
} from "@/lib/use-map-filters";
import { setAreaPrefer, useAreaPrefer } from "@/lib/use-area-prefer";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";
import { CHIP, CHIP_OFF, CHIP_ON, HEADER_PILL } from "./header-classes";

/** Near and Popular, which replaced All (Pato, MESITA-2426). Popular wears
 *  the star All wore (MESITA-2422); each icon is FAMILY_ICONS[prefer]. */
export const EVERY_FAMILY_CHIPS = [
  { prefer: "near", label: "Nearby" },
  { prefer: "popular", label: "Popular" },
] as const;

/** A chip's line icon, never an emoji (MESITA-2478): 1.75 stroke, 2.25 when
 *  on — BottomNav's pair. */
const CHIP_ICON = "h-4 w-4 shrink-0";

/** Each chip group opens on a 3px clay bar, the Home rail's two colours
 *  (Pato, MESITA-2484/2487/2492): red for Nearby · Popular, blue for the
 *  families. Literal classes, so Tailwind sees them. */
export const CHIP_GROUP_MARK = {
  around: "h-6 w-[3px] shrink-0 rounded-full bg-[oklch(0.68_0.09_35)]",
  families: "h-6 w-[3px] shrink-0 rounded-full bg-[oklch(0.66_0.06_245)]",
} as const;

export function SearchHeader({
  locate,
  bar,
  chipsHidden = false,
  children,
}: {
  /** The locate disc, at the left of the bar's row. */
  locate: ReactNode;
  /** The query bar; it takes what the two buttons leave. */
  bar: ReactNode;
  /** While the bar is querying the chip row is not drawn (Pato,
   *  MESITA-2487: "make the bar of categories disappear when searching");
   *  the results then hang just under the bar's row. */
  chipsHidden?: boolean;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const prefer = useAreaPrefer();
  const everyFamily = filters.familyKeys.length === 0;
  return (
    <div
      className="border-border bg-card relative z-30 shrink-0 border-b"
      data-search-header
      data-search-band
    >
      {/* ONE white band for the bar's row AND the chips, one hairline under
          both (Pato, MESITA-2469: Apple Maps / Instagram); the grey chip band
          of MESITA-2462 is gone. Controls are grey fills, so they read on
          the white. A full-width hairline splits the two rows, each with
          10px above and below (Pato, MESITA-2479: "top box, line, bottom
          box"). */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
        {locate}
        <div className="min-w-0 flex-1">{bar}</div>
        <Link
          href={CONSUMER_ROUTES.searchChat}
          className={HEADER_PILL}
          data-search-ask-ai
        >
          <BotMessageSquare
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          <span>Ask AI</span>
        </Link>
      </div>
      <div
        className={cn("relative", !chipsHidden && "border-border border-t")}
        data-search-chip-band
      >
        {chipsHidden ? null : (
          <nav
            aria-label="Families"
            className="scrollbar-hide flex items-center gap-2 overflow-x-auto overscroll-x-contain px-3 py-2.5"
            data-search-chips
          >
            <span
              aria-hidden
              className={CHIP_GROUP_MARK.around}
              data-chip-group="around"
            />
            {EVERY_FAMILY_CHIPS.map((c) => {
              const on = everyFamily && prefer === c.prefer;
              return (
                <button
                  key={c.prefer}
                  type="button"
                  onClick={() => {
                    clearMapFamilies();
                    setAreaPrefer(c.prefer);
                  }}
                  aria-pressed={on}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                  data-area-prefer={c.prefer}
                >
                  <FamilyIcon
                    name={c.prefer}
                    className={CHIP_ICON}
                    strokeWidth={on ? 2.25 : 1.75}
                  />
                  <span>{c.label}</span>
                </button>
              );
            })}
            <span
              aria-hidden
              className={cn(CHIP_GROUP_MARK.families, "ml-1")}
              data-chip-group="families"
            />
            {FILTERABLE_PLACE_FAMILIES.map((family) => {
              const on =
                filters.familyKeys.length === 1 &&
                filters.familyKeys[0] === family.key;
              return (
                <button
                  key={family.key}
                  type="button"
                  onClick={() => {
                    // A family ranks Near; picking it again is Near.
                    setAreaPrefer("near");
                    selectMapFamily(family.key);
                  }}
                  aria-pressed={on}
                  className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                >
                  <FamilyIcon
                    name={family.key}
                    className={CHIP_ICON}
                    strokeWidth={on ? 2.25 : 1.75}
                  />
                  <span>{family.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        {children ? (
          <div
            className={cn(
              "absolute inset-x-3 top-0 z-10 flex flex-col gap-2",
              chipsHidden && "pt-2",
            )}
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
