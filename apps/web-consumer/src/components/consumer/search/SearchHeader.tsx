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
// Ask AI pill with sparkles (opens a popup over Search; MESITA-4480,
// MESITA-3010). One token set for every control lives in header-classes.ts. NO ADD
// DISC (MESITA-2876's `+`), and no Add button since MESITA-2883: Add a
// place has its own sheet (MESITA-2902). Under the bar's row one chip row:
// THE FILTERS DISC AT THE FAR LEFT (Pato, MESITA-2882: "keep the Filters
// icon at the super left"), pinned outside the scroll: a white icon-only
// disc (MESITA-3006; MESITA-2999's worded chip "looks like [bad]"; Menu since MESITA-4466), then Popular, then every
// family, each with its emoji (Pato, MESITA-3760: "the emojis must exist
// here too"; Home's column has worn them since MESITA-3683).
// Popular, as on Home (Pato, MESITA-4466: "rename top to popular here and
// follow rule and filters is menu"; Top since MESITA-2882). MENU, NOT
// FILTERS: the disc became Home's Menu box, the grid mark and the word, a
// rounded square; Popular and every family are pills (Pato, MESITA-4468:
// "better in this page only popular too rounded"; MESITA-4466 had Popular
// square too). THE DISC OPENS THE FILTERS SHEET
// (Pato, MESITA-2903). ONE FAMILY (Pato, MESITA-4469: "not multiselector"):
// the Menu opens Home's Categories modal and a tap picks that one family,
// or Popular, and closes. A chip does the same. Popular is lit when none
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
import { LayoutGrid } from "lucide-react";
import { AiSparkle } from "./AiSparkle";
import { AskAiModal } from "./AskAiModal";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";
import {
  clearMapFamilies,
  selectMapFamily,
  setMapFamilies,
  setMapSpecial,
  useMapFilters,
} from "@/lib/use-map-filters";
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
  const special = filters.special;
  const everyFamily = special === null && filters.familyKeys.length === 0;
  const filtered = filters.familyKeys.length > 0;
  // Signed out, nothing is saved (MESITA-4325): no Saved chip.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
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
        {/* The pill is the sparkle and the short word "AI" (Pato,
            MESITA-4496: "rename ask ai button to just ai to save space for
            search bar"). The accessible name stays Ask AI. MESITA-4007 had
            the full words beside the icon; MESITA-3991 was a mark-only disc.
            It opens a popup titled Ask AI (MESITA-4480). */}
        <button
          type="button"
          onClick={() => setAskOpen(true)}
          className={HEADER_PILL}
          data-search-ask-ai
          aria-haspopup="dialog"
          aria-label="Ask AI"
        >
          <AiSparkle className={HEADER_ICON} />
          <span>AI</span>
        </button>
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
              aria-label={filtered ? "Menu, a family is chosen" : "Menu"}
              aria-haspopup="dialog"
              className={cn(CHIP_SPECIAL, CHIP_OFF, "relative")}
              data-search-filters
            >
              <LayoutGrid
                className="h-4 w-4 shrink-0"
                strokeWidth={HEADER_ICON_STROKE}
                aria-hidden
              />
              <span>Menu</span>
              {/* A family is chosen: a red dot says the list is filtered
                  (Pato, 2026-11-22, MESITA-4685). */}
              {filtered ? (
                <span
                  aria-hidden
                  className="bg-destructive ring-card absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2"
                  data-menu-filter-dot
                />
              ) : null}
            </button>
            <nav
              aria-label="Families"
              className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-2 pr-3"
              data-search-chips
            >
              {/* Menu, Popular, then the families (Pato, MESITA-3198, undoing
                  MESITA-3195): Menu stays pinned, Popular scrolls with them. */}
              {/* Nearby · Popular (MESITA-4592). */}
              {/* NO SAVED ON SEARCH (Pato, 2026-11-23, MESITA-4786: "remove
                  saved from the search mode"): Home keeps its ❤️ Saved. */}
              <button
                type="button"
                onClick={() => setMapSpecial("nearby")}
                aria-pressed={special === "nearby"}
                className={cn(CHIP, special === "nearby" ? CHIP_ON : CHIP_OFF)}
                data-search-chip-nearby
              >
                <span aria-hidden className={CHIP_EMOJI}>
                  📍
                </span>
                <span>Nearby</span>
              </button>
              <button
                type="button"
                onClick={clearMapFamilies}
                aria-pressed={everyFamily}
                className={cn(CHIP, everyFamily ? CHIP_ON : CHIP_OFF)}
                data-search-chip-top
              >
                <span aria-hidden className={CHIP_EMOJI}>
                  {POPULAR_EMOJI}
                </span>
                <span>Popular</span>
              </button>
              {FILTERABLE_PLACE_FAMILIES.map((family) => {
                const on = special === null && filters.familyKeys.includes(family.key);
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
        special={special}
        onSpecial={setMapSpecial}
      />
      <AskAiModal open={askOpen} onClose={() => setAskOpen(false)} />
    </div>
  );
}
