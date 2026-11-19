"use client";

// Search's header (Pato, MESITA-2409 — OpenTable's shape). MESITA-2879 puts
// back the MESITA-2875 chip row and the three-control bar row ("Location |
// Searchbar | Ask AI / Families Carousel as in the past"):
//
//   (⌖) [ ⚲ Search places…   ] (✨ Ask AI)      three separate 40px controls
//   [▦ Menu] [⭐ Popular] (○ Coffee) …          32px chips, floating
//
// THREE SEPARATE CONTROLS (Pato, MESITA-3009: "location at the left,
// searchbar, ask ai at the right, all separated"; MESITA-2999's one long
// bar held Ask AI and locate): the locate disc, the query bar, the white
// Ask AI pill with sparkles (→ Search › Chat; MESITA-3010). One token set for every control lives in header-classes.ts. NO ADD
// DISC (MESITA-2876's `+`), and no Add button since MESITA-2883: Add a
// place has its own sheet (MESITA-2902). Under the bar's row one chip row:
// THE FILTERS DISC AT THE FAR LEFT (Pato, MESITA-2882: "keep the Filters
// icon at the super left"), pinned outside the scroll: a white icon-only
// disc (MESITA-3006; MESITA-2999's worded chip "looks like [bad]"; Menu since MESITA-4466), then Popular, then every
// family, each with its emoji (Pato, MESITA-3760: "the emojis must exist
// here too"; Home's column has worn them since MESITA-3683).
// Popular, as on Home (Pato, MESITA-4466: "rename top to popular here and
// follow rule and filters is menu"; Top since MESITA-2882). MENU, NOT
// FILTERS: the disc became Home's Menu box, the grid mark and the word, and
// Menu and Popular are rounded squares while the families stay pills
// (Home's MESITA-4428 rule: "square boxes for the special boxes"). THE DISC OPENS THE FILTERS SHEET
// (Pato, MESITA-2903: "when i click filters, open the modal to see select
// multiple families"; MESITA-2879 had deleted MESITA-2758's sheet and made
// the disc a clear): any number of families, applied at once. While any is
// picked the disc wears a small black bubble with the count (MESITA-3006;
// MESITA-2884's red disc is gone).
// NO NEARBY, NO POPULAR (MESITA-2499/2502): the map is the where, a chip
// is only the what. A chip picks its family ALONE; it is lit while its
// family is in the set (the sheet may hold several); Popular is lit when none
// is; tapping the only lit family goes back to Popular. Sent as the
// server-side `familyKeys`. The Minimum Popularity stays the operator's,
// Admin › Discovery › Area.
//
// A WHITE TOP HEADER, FLOATING CHIPS (Pato, MESITA-3019: "make a top header
// for the searchbar … location searchbar and ask ai with white background,
// then the filters and categories actually floating"; MESITA-2996 had no
// band at all). Row one is a white band with a hairline under it; the chip
// row under it is transparent, lets taps through to the map, and each chip
// is a white pill with a shadow (header-classes.ts).
// The chips are shorter than the bar (MESITA-2996; reverses MESITA-2445).
// `children` (the bar's results, the load error) COVER the chip row and run
// on over the map (MESITA-2417); while the bar queries the chip row is not
// drawn at all (MESITA-2487).

import { useState, type ReactNode } from "react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { LayoutGrid } from "lucide-react";
import { AiSparkle } from "./AiSparkle";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  clearMapFamilies,
  selectMapFamily,
  setMapFamilies,
  useMapFilters,
} from "@/lib/use-map-filters";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { FamilyFilterSheet } from "./FamilyFilterSheet";
import { cn } from "@/lib/utils";
import {
  BAR,
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  CHIP_SPECIAL,
  HEADER_BAND,
  HEADER_ICON,
  HEADER_ICON_STROKE,
  HEADER_PILL,
  DISC_BADGE,
} from "./header-classes";

// A chip's mark is its family's emoji, the same one Home's column wears
// (MESITA-3760, undoing MESITA-2478's line icons here); Popular is ⭐ as on Home.
const CHIP_EMOJI = "w-4 shrink-0 text-center text-sm leading-none";
const POPULAR_EMOJI = "⭐";


export function SearchHeader({
  locate,
  bar,
  chipsHidden = false,
  children,
}: {
  /** The locate disc, left of the bar on row one. */
  locate: ReactNode;
  /** The query field; the bar takes what the two controls leave. */
  bar: ReactNode;
  /** While the bar is querying the chip row is not drawn (MESITA-2487);
   *  the results then hang just under the bar's row. */
  chipsHidden?: boolean;
  /** Over the chips: the bar's results, the load error. */
  children?: ReactNode;
}) {
  const filters = useMapFilters();
  const everyFamily = filters.familyKeys.length === 0;
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    // pointer-events-none on the overlay, back on for each control: the gaps
    // between the pills are the map's.
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
      data-search-header
    >
      {/* Row one, three separate controls (Pato, MESITA-3009: "location at
          the left, searchbar, ask ai at the right, all separated"). */}
      <div
        className={cn(
          HEADER_BAND,
          "pointer-events-auto flex min-w-0 items-center gap-3 p-3",
        )}
        data-search-header-band
      >
        {locate}
        <div className={cn(BAR, "min-w-0 flex-1")}>{bar}</div>
        {/* Ask AI is the sparkle AND the words (Pato, MESITA-4007: "keep the
            Ask AI word but with the icon"): the white pill again, as before
            MESITA-3991's mark-only disc; the brain-circuit and chip marks
            (MESITA-3995, MESITA-3999) are gone. */}
        <PushLink
          href={CONSUMER_ROUTES.searchChat}
          className={HEADER_PILL}
          data-search-ask-ai
        >
          <AiSparkle className={HEADER_ICON} />
          <span>Ask AI</span>
        </PushLink>
      </div>
      <div className="relative" data-search-chip-band>
        {chipsHidden ? null : (
          // py-2 inside the scroller, not around it: its overflow would clip
          // the chips' shadows. ONE 12px SPACING (Pato, MESITA-3012: "the
          // distance across searchbar and filters and top screen is the
          // same"): the screen top, between row one's controls, and bar to
          // chips (this row's pt-1 + the scroller's py-2) are all 12px, the
          // side gutter; chip to chip stays 8px.
          <div className="flex min-w-0 items-center gap-3 pt-1 pl-3 [&>*]:pointer-events-auto">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={
                everyFamily
                  ? "Menu"
                  : `Menu (${filters.familyKeys.length} selected)`
              }
              aria-haspopup="dialog"
              data-active={everyFamily ? undefined : "true"}
              className={cn(CHIP_SPECIAL, CHIP_OFF, "relative")}
              data-search-filters
            >
              <LayoutGrid
                className="h-4 w-4 shrink-0"
                strokeWidth={HEADER_ICON_STROKE}
                aria-hidden
              />
              <span>Menu</span>
              {everyFamily ? null : (
                <span
                  aria-hidden
                  // Only the bubble is red (Pato, MESITA-3216, replacing MESITA-3192).
                  className={cn(DISC_BADGE, "bg-destructive text-destructive-foreground")}
                  data-search-filters-badge
                >
                  {filters.familyKeys.length}
                </span>
              )}
            </button>
            <nav
              aria-label="Families"
              className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-2 pr-3"
              data-search-chips
            >
              {/* Menu, Popular, then the families (Pato, MESITA-3198, undoing
                  MESITA-3195): Menu stays pinned, Popular scrolls with them. */}
              <button
                type="button"
                onClick={clearMapFamilies}
                aria-pressed={everyFamily}
                className={cn(CHIP_SPECIAL, everyFamily ? CHIP_ON : CHIP_OFF)}
                data-search-chip-top
              >
                <span aria-hidden className={CHIP_EMOJI}>
                  {POPULAR_EMOJI}
                </span>
                <span>Popular</span>
              </button>
              {FILTERABLE_PLACE_FAMILIES.map((family) => {
                const on = filters.familyKeys.includes(family.key);
                return (
                  <button
                    key={family.key}
                    type="button"
                    // Picking the lit family again goes back to Popular.
                    onClick={() => selectMapFamily(family.key)}
                    aria-pressed={on}
                    className={cn(CHIP, on ? CHIP_ON : CHIP_OFF)}
                  >
                    <span aria-hidden className={CHIP_EMOJI}>
                      {family.emoji}
                    </span>
                    <span>{family.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
        {children ? (
          <div
            className={cn(
              "pointer-events-auto absolute inset-x-3 top-0 z-10 flex flex-col gap-2 pt-3",
            )}
            data-search-over-chips
          >
            {children}
          </div>
        ) : null}
      </div>
      <FamilyFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        applied={filters.familyKeys}
        onApply={setMapFamilies}
      />
    </div>
  );
}
