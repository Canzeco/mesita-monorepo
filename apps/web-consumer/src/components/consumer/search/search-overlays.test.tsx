import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RailCard } from "@/components/consumer/search/SearchRailCard";
import { SearchResultsPanel } from "@/components/consumer/search/SearchResultsPanel";
import { SearchFilterRow } from "@/components/consumer/search/SearchFilterRow";
import { SearchLocateButton } from "@/components/consumer/search/SearchLocateButton";
import {
  buildSearchMapPins,
  locationTypeLabel,
} from "@/components/consumer/search/search-pins";
import { SearchRailOverlay } from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import {
  ANCHOR_DROP_KM,
  anchorPlaceFromPrediction,
  anchorSurvivesReload,
  anchorViewportBounds,
  catalogIsStale,
  clampReloadMinKm,
  clampReloadMinSec,
  defaultRailSelection,
  shouldCenterRailCard,
  nearbyReloadThresholdKm,
  prependAnchorPlace,
  railCenterIndex,
  shouldReloadNearbyCatalog,
  viewportCenter,
} from "@/components/consumer/search/search-utils";
import type { Place } from "@/lib/api/places";
import type { PlacePrediction } from "@/lib/api/place-search";

const SEARCH_DIR = join(__dirname);

function read(name: string): string {
  return readFileSync(join(SEARCH_DIR, name), "utf8");
}

// Docs › Design §D + Docs › Apps §A: Search is the map plus a results panel whose
// HEIGHT FITS CONTENT. A fixed tall empty panel (h-[70%] and friends) is the
// named regression — short lists must leave the map visible below.

describe("Search overlays never use a fixed-height empty panel", () => {
  it("does not hardcode h-[70%] on the prompt, results, or client", () => {
    const fixedHeight = /(?<!max-)h-\[70%\]/;
    expect(read("search-catalog-overlays.tsx")).not.toMatch(fixedHeight);
    expect(read("SearchResultsPanel.tsx")).not.toMatch(fixedHeight);
    expect(read("SearchClient.tsx")).not.toMatch(fixedHeight);
  });
});

describe("SearchBar", () => {
  // THE MOBILE KEYBOARD, told what this field is. Rendered rather than read
  // off the source: the comment in SearchBar explaining why type=search is
  // wrong contains the string a source-level check would trip over.
  it("asks iOS for a search keyboard without WebKit's second clear button", () => {
    const html = renderToStaticMarkup(
      <SearchBar
        query=""
        showClear={false}
        onQueryChange={() => {}}
        onClear={() => {}}
      />,
    );
    // React passes these through with their JSX casing intact.
    expect(html).toContain('enterKeyHint="search"');
    expect(html).toContain('autoCapitalize="none"');
    expect(html).toContain('autoCorrect="off"');
    expect(html).toContain('spellCheck="false"');
    // WebKit draws its own X on a search input, one pill away from ours.
    expect(html).not.toContain('type="search"');
  });
});

describe("Search map catalog auto-reloads after distance and time", () => {
  it("loads the operator's How many, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    // How many stays the operator's. The guest posts Family and Google
    // Reviews; the source is never the guest's (MESITA-2384).
    expect(read("SearchClient.tsx")).not.toContain("resultLimit");
    expect(read("SearchClient.tsx")).not.toContain("placesScope");
    expect(read("SearchClient.tsx")).toContain("familyKeys");
    expect(read("SearchClient.tsx")).toContain("minReviews");
    expect(read("SearchClient.tsx")).toContain("onFirstViewport");
    expect(read("SearchClient.tsx")).toContain("shouldReloadNearbyCatalog");
    expect(read("SearchClient.tsx")).toContain("scheduleOrLoad");
    expect(read("SearchClient.tsx")).not.toContain("handleSearchHere");
    expect(read("SearchClient.tsx")).not.toContain("SearchHereButton");
    expect(read("SearchClient.tsx")).not.toContain("VIEWPORT_IDLE_MS");
    expect(read("SearchMap.tsx")).toContain("ViewportReporter");
    expect(read("SearchMap.tsx")).toContain("SearchMapReticle");
    expect(read("SearchMap.tsx")).toContain("noteProgrammaticCamera");
    expect(read("SearchMap.tsx")).toContain("noteUserMapDrag");
    expect(read("SearchMap.tsx")).toContain('addListener("dragstart"');
    expect(read("SearchMap.tsx")).not.toContain("PROGRAMMATIC_IDLE_MS");
    expect(read("search-catalog-overlays.tsx")).toContain("Finding nearby");
    expect(read("search-catalog-overlays.tsx")).toContain("Updating nearby");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Search here");
    expect(read("SearchClient.tsx")).toContain("++viewportGen.current");
    expect(read("SearchClient.tsx")).not.toContain("toFixed(3)");
    // `google: true` survives and is NOT the ring: it says this client can
    // render a Google-only stub; the EF refuses a call without it
    // (MESITA-2337).
    expect(read("../../../lib/api/places.ts")).toContain("google: true");
    expect(read("../../../lib/api/places.ts")).toContain("reloadMinSec");
  });

  it("waits the remaining reloadMinSec when the camera already moved far enough", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("catalogMovedEnough");
    expect(src).toContain("setTimeout");
    expect(src).toContain("reloadMinSec");
    expect(src).toContain("markViewport(box)");
    expect(src).toContain("forceNextLoad");
    expect(src).toContain("meta.programmatic");
    expect(src).toMatch(
      /if \(meta\.programmatic\) \{[\s\S]*return;[\s\S]*scheduleOrLoad/,
    );
  });

  it("rebases lastFetchedCenter on rail or pin pans so those meters do not accrue", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(
      /if \(meta\.programmatic\) \{[\s\S]*lastFetchedCenter\.current = viewportCenter\(box\)/,
    );
    expect(src).toContain("cannot accumulate toward reload");
    expect(src).toContain("Only a finger-drag on the map counts as travel");
  });

  it("treats every idle after a rail pan as programmatic until dragstart", () => {
    const src = read("SearchMap.tsx");
    expect(src).toContain("cameraMoveIsProgrammatic");
    expect(src).toContain("noteUserMapDrag");
    expect(src).toMatch(/addListener\("dragstart", noteUserMapDrag\)/);
    expect(src).not.toContain("PROGRAMMATIC_IDLE_MS");
    expect(src).not.toContain("programmaticIdleUntil");
  });

  it("reloads once when a later GPS fix lands off the fetched camera", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("firstFix");
    expect(src).toMatch(/catalogIsStale\(lastFetchedCenter\.current, next\)/);
    expect(src).toContain("forceNextLoad.current = true");
  });
});

describe("SearchFilterRow", () => {
  // A 44px DISC, ICON ONLY (Pato, 2026-10-17: "don't mention filters as
  // text, just the filters icon is enough and universal"), retiring the
  // labelled third of MESITA-1797. The word lives in the accessible name;
  // applied is a brand-red dot on the corner (MESITA-2304), never a fill.
  it("is an icon-only disc that wears the red dot when on", () => {
    const rest = renderToStaticMarkup(
      <SearchFilterRow count={0} onOpenFilters={() => {}} />,
    );
    expect(rest).toContain("lucide-sliders-horizontal");
    expect(rest).toContain('aria-label="Filters"');
    expect(rest).not.toMatch(/>\s*Filters\s*</);
    expect(rest).not.toContain("Filter places");
    expect(rest).not.toContain("basis-1/3");
    expect(rest).not.toContain('data-active="true"');
    expect(rest).toContain("h-11 w-11");
    expect(rest).toContain("rounded-full");
    expect(rest).toContain("border-border");
    expect(rest).toContain("bg-card/95");
    expect(rest).toContain("shadow-elev");
    expect(rest).not.toContain("bg-primary ");
    expect(rest).not.toContain("Restaurants");
    expect(rest).not.toContain("Bars");
    expect(rest).not.toContain("Now");

    const on = renderToStaticMarkup(
      <SearchFilterRow count={3} onOpenFilters={() => {}} />,
    );
    expect(on).toContain('aria-label="Filters, 3 applied"');
    expect(on).toContain('data-active="true"');
    expect(on).toContain("bg-primary");
    expect(on).not.toContain("text-primary-foreground");
    expect(on).not.toContain(">3<");
    expect(read("SearchFilterRow.tsx")).not.toContain("PLACE_FAMILIES");
  });

  // THE ANTI-DISAPPEARING PAIR. Flex resolves an overflowing row by shrinking
  // whichever child can shrink. Drop `shrink-0` here and the bar squeezes
  // this control toward zero width while it is still in the DOM.
  it("cannot be squeezed out by the bar beside it", () => {
    const rest = renderToStaticMarkup(
      <SearchFilterRow count={0} onOpenFilters={() => {}} />,
    );
    expect(rest).toContain("shrink-0");

    const src = read("SearchClient.tsx");
    expect(src).toContain('<div className="min-w-0 flex-1">');
    expect(src).toContain('<div className="flex min-w-0 items-center gap-2">');
  });
});

describe("SearchLocateButton", () => {
  // THE LOCATION DISC, TOP LEFT (Pato, 2026-10-17: "Location Searchbar
  // Filters … location at the left"). The navigation arrow, icon only; the
  // name says what a tap does: ask for a fix, or recentre on the one the
  // map has. A held fix wears the red dot (MESITA-2304).
  it("is an icon-only arrow disc whose name follows the fix", () => {
    const ask = renderToStaticMarkup(
      <SearchLocateButton located={false} locating={false} onClick={() => {}} />,
    );
    expect(ask).toContain("lucide-navigation");
    expect(ask).not.toContain("lucide-locate-fixed");
    expect(ask).not.toContain('data-active="true"');
    expect(ask).toContain('aria-label="Use my location"');
    expect(ask).toContain("h-11 w-11");
    expect(ask).toContain("shrink-0");
    expect(ask).toContain("rounded-full");
    expect(ask).toContain("shadow-elev");
    expect(ask).not.toMatch(/>\s*Use my location\s*</);
    const home = renderToStaticMarkup(
      <SearchLocateButton located locating={false} onClick={() => {}} />,
    );
    expect(home).toContain('aria-label="Recentre on your location"');
    expect(home).toContain('data-active="true"');
    expect(home).toContain("bg-primary");
    const busy = renderToStaticMarkup(
      <SearchLocateButton located={false} locating onClick={() => {}} />,
    );
    expect(busy).toContain('aria-label="Locating"');
    expect(busy).toContain("disabled");
  });
});

describe("Search map's top row is location, the query bar and the Filters disc", () => {
  it("puts location at the left and Filters at the right, with no client-side recut", () => {
    const src = read("SearchClient.tsx");
    const overlays = read("search-catalog-overlays.tsx");
    expect(src).toContain("SearchFilterRow");
    // Location disc, then the bar, then Filters — in that order in the row.
    const row = src.slice(src.indexOf('<div className="flex min-w-0 items-center gap-2">'));
    expect(row.indexOf("<SearchLocateButton")).toBeGreaterThan(-1);
    expect(row.indexOf("<SearchLocateButton")).toBeLessThan(row.indexOf("<SearchBar"));
    expect(row.indexOf("<SearchBar")).toBeLessThan(row.indexOf("<SearchFilterRow"));
    expect(src).toContain("recentreOnGuest");
    // Recentre reloads when the catalog was fetched elsewhere (MESITA-2305).
    const recentre = src.slice(
      src.indexOf("const recentreOnGuest"),
      src.indexOf("const resetSearchSession"),
    );
    expect(recentre).toContain("catalogIsStale(lastFetchedCenter.current, location)");
    expect(recentre).toContain("forceNextLoad.current = true");
    expect(recentre).toContain("setHomeNonce");
    expect(src).toContain("SearchMapFilters");
    expect(src).toContain("catalogLoading ? null : catalog.length");
    expect(src).toContain("useMapFilters");
    expect(src).toContain("mapFilterCount");
    expect(src).toContain("flex min-w-0 items-center gap-2");
    expect(src).toContain("<SearchBar");
    // The SERVER is the one selector — SearchClient posts the three
    // params and paints what comes back.
    expect(src).not.toMatch(/takeMapResultLimit\(/);
    expect(src).toMatch(/from "@\/lib\/map-filters-engine"/);
    for (const present of [
      "SearchFilterRow.tsx",
      "SearchLocateButton.tsx",
      "SearchMapFilters.tsx",
      "SearchPopularity.tsx",
    ]) {
      expect(existsSync(join(SEARCH_DIR, present)), present).toBe(true);
    }
    expect(existsSync(join(SEARCH_DIR, "SearchPlacesScope.tsx"))).toBe(false);
    // The sheet: Families, then Google Reviews; the Places source switch is
    // gone (MESITA-2384), and the word Enriched never reaches the guest.
    const sheet = read("SearchMapFilters.tsx");
    const popularity = read("SearchPopularity.tsx");
    expect(sheet).not.toContain('label="Places"');
    expect(sheet).not.toContain("SearchPlacesScope");
    expect(sheet).toContain('label="Families"');
    expect(sheet).toContain('label="Google Reviews"');
    expect(sheet.indexOf('label="Families"')).toBeLessThan(sheet.indexOf('label="Google Reviews"'));
    expect(sheet).not.toContain("Minimum number of Google reviews");
    expect(sheet).toContain("All Families");
    expect(sheet).toContain("clearMapFamilies");
    expect(sheet).not.toContain('label="Popularity"');
    for (const file of [sheet, popularity]) {
      expect(file).not.toMatch(/Enriched/);
    }
    expect(popularity).toContain('aria-label="Google Reviews"');
    expect(popularity).not.toContain('"0+"');
    expect(popularity).toContain('"10+"');
    expect(popularity).toContain('"100+"');
    expect(popularity).toContain('"1,000+"');
    expect(popularity).not.toContain('"10K+"');
    for (const gone of ["SearchResultLimit.tsx", "SearchCategoryRow.tsx"]) {
      expect(existsSync(join(SEARCH_DIR, gone)), gone).toBe(false);
    }
    for (const present of ["map-filters-engine.ts", "use-map-filters.ts"]) {
      expect(
        existsSync(join(SEARCH_DIR, "../../../lib", present)),
        present,
      ).toBe(true);
    }
    expect(overlays).not.toContain("SlidersHorizontal");
    expect(overlays).not.toContain("onResetFilters");
    expect(overlays).not.toMatch(/>\s*Reset filters\s*</);
    expect(overlays).not.toContain("Adjust");
    expect(src).not.toContain("useDiscoveryFilters");
    expect(src).not.toContain("DiscoveryFilters");
    expect(
      existsSync(join(SEARCH_DIR, "../../../lib/use-discovery-filters.ts")),
    ).toBe(false);
    const suggestArgs = [
      ...src.matchAll(/apiSuggestPlacesWithIdle\(([\s\S]*?)\);/g),
    ].map((m) => m[1]);
    expect(suggestArgs).toHaveLength(1);
    expect(suggestArgs.join("\n")).toContain('"deep"');
    for (const args of suggestArgs) expect(args).not.toContain("filters");
    const loading = read("../../../app/(shell)/(discovery)/search/loading.tsx");
    expect(loading).toContain("flex min-w-0 items-center gap-2");
    expect(loading).not.toContain("basis-1/3");
    expect(loading.split("h-11 w-11 shrink-0").length - 1).toBe(2);
    expect(loading).not.toContain("h-12 w-12");
  });

  it("recenters the map on the location param, not only the device", () => {
    expect(read("SearchClient.tsx")).toMatch(/viewCenter=\{center\}/);
    expect(read("SearchMap.tsx")).toContain("viewCenter");
    expect(read("SearchMap.tsx")).toMatch(/Recentre target=\{lookAt\}/);
  });
});

describe("Search pin two-tap (select then open)", () => {
  it("fills pins with the tone color and rings the selected one", () => {
    expect(read("SearchMap.tsx")).toContain("pinFillColor");
    expect(read("SearchMap.tsx")).toContain("pinStrokeColor");
    expect(read("SearchClient.tsx")).toContain("overlayPinDecision");
    expect(read("../../../lib/map-defaults.ts")).toMatch(
      /MAP_PLACE_PIN_RADIUS = 10/,
    );
    expect(read("../../../lib/map-defaults.ts")).toMatch(
      /MAP_PIN_HIT_SIZE = 44/,
    );
    expect(read("../../../lib/map-defaults.ts")).toContain(
      "export function mapPinIcon",
    );
    expect(read("SearchMap.tsx")).toContain("mapsPinIcon(pinFillColor");
    expect(read("SearchMap.tsx")).toContain("mapPinIcon");
    expect(read("SearchMap.tsx")).toContain("userIcon()");
    expect(read("SearchMap.tsx")).toContain("cursor={MAP_PIN_CURSOR}");
    expect(read("SearchMap.tsx")).toContain("draggableCursor={MAP_PIN_CURSOR}");
    expect(read("SearchMap.tsx")).toContain("draggingCursor={MAP_PIN_CURSOR}");
    expect(read("SearchMap.tsx")).toContain("optimized={false}");
    expect(read("SearchMap.tsx")).toContain("[&_*]:!cursor-default");
    expect(read("SearchMap.tsx")).not.toContain("M -6 0 A 6 6");
    expect(read("SearchMap.tsx")).not.toContain("scale: isSelected");
    expect(read("SearchMap.tsx")).not.toContain("strokeWeight: isSelected");
  });

  it("first overlay tap selects; a later tap on the same pin opens", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("overlayPinDecision");
    expect(src).toContain("heldOverlay");
    expect(src).toContain("select-mesita-overlay");
    expect(src).toContain("setHeldOverlay(prediction)");
    expect(src).toContain("setSelectedId(pin.id)");
    expect(src).not.toContain("heldGoogle");
  });
});

describe("Search results drop from the bar, not from the bottom", () => {
  // The convention every autocomplete follows, and how the standalone Search
  // page stacked them: header band, then the list directly beneath it.
  //
  // NESTED IN THE TOP OVERLAY, deliberately. An absolutely-positioned panel
  // with its own `top` offset has to be kept in sync with the bar's height by
  // hand, and the bar just went h-12 -> h-11. Sharing the flex column means
  // the browser does that arithmetic.
  it("renders the results inside the top overlay column, not docked bottom", () => {
    const src = read("SearchClient.tsx");
    const overlay = src.slice(src.indexOf("absolute inset-x-3 top-3"));
    const results = overlay.indexOf("<SearchResultsPanel");
    const closes = overlay.indexOf("<SearchRailOverlay");
    expect(results).toBeGreaterThan(-1);
    // The panel is reached before the rail, i.e. still inside the top column.
    expect(results).toBeLessThan(closes);
    expect(src).not.toContain("inset-x-0 bottom-0 z-20");
  });

  it("caps the dropdown with max-h so short lists leave the map visible", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("max-h-[55dvh]");
    // A bare height would bring back the regression the 2026-09-01 removal was
    // actually right about: a panel that claimed the same slab of screen
    // whether it held two rows or ten.
    expect(src).not.toMatch(/(?<!max-)h-\[55dvh\]/);
  });

  // THE RAIL STEPS ASIDE FOR THE KEYBOARD, not for the second character.
  // `querying` starts at MIN_QUERY, which is the wrong moment twice over on a
  // phone: the keyboard is already up at zero characters, and it is still up
  // while the guest deletes back down to one. Both halves are load-bearing —
  // focus opens search mode, a live query holds it open past the blur that a
  // result tap causes, so the rail cannot flash back in under the camera move.
  it("hides the catalog rail for the whole of search mode", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(/const searchMode = barFocused \|\| querying;/);
    expect(src).toMatch(/\{!searchMode && \(\s*<SearchRailOverlay/);
  });

  // MESITA-1616: Search moved to its own route, so `barFocused` became LOCAL
  // state, not a context shared with a sibling mode rail. Home's rail
  // (ModeTabs, drawn by discover/layout.tsx) never coordinates with the bar.
  // This pins that the old cross-component coordination
  // (DiscoverChromeProvider) is gone, not just unused, so it can't quietly
  // regrow without a deliberate edit here.
  it("tracks bar focus locally — no shared context with the rail above it", () => {
    const src = read("SearchClient.tsx");
    // Both edges. onFocus alone leaves searchMode stuck open for the session.
    expect(src).toContain("onFocus={() => setBarFocused(true)}");
    expect(src).toContain("onBlur={() => setBarFocused(false)}");
    expect(src).toContain("useState(false)");
    expect(src).not.toContain("useDiscoverChrome");

    const nav = read("../ModeTabs.tsx");
    expect(nav).not.toContain("useDiscoverChrome");
    expect(nav).not.toContain("barFocused");

    const layout = read("../../../app/(shell)/(discovery)/discover/layout.tsx");
    // Not a bare word check — this file's own comment explains the removal
    // and names the removed symbol, so a substring match on the word alone
    // would false-fail against its own explanation. Check for actual usage:
    // the import and the JSX tag, not prose mentioning history.
    expect(layout).not.toContain(
      'from "@/components/consumer/discover/discover-chrome"',
    );
    expect(layout).not.toContain("<DiscoverChromeProvider");
  });
});

describe("Every terminal search state offers a way out", () => {
  // The panel covers part of a map. An empty or failed search that just sits
  // there is a lid with nothing under it, so both states carry an action.
  it("gives no-matches a Clear search and an error a Try again", () => {
    const panel = read("SearchResultsPanel.tsx");
    expect(panel).toContain("Clear search");
    expect(panel).toContain("Try again");
    expect(panel).toContain("onClearSearch");
    expect(panel).toContain("onRetry");
    // The below-minimum prompt was unreachable once this panel stopped being a
    // full page — it only mounts at 2+ characters.
    expect(panel).not.toContain("Keep typing");
  });

  it("wires retry to a nonce, since the debounce keys on the query text", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("searchNonce");
    expect(src).toMatch(
      /\[supabase, trimmedQuery, searchOrigin, searchNonce\]/,
    );
    expect(src).toContain("setSearchNonce((n) => n + 1)");
  });
});

describe("Search results are one unlabeled lane", () => {
  it("does not print On Mesita / From Google section headers", () => {
    const src = read("SearchResultsPanel.tsx");
    expect(src).not.toMatch(/On Mesita/);
    expect(src).not.toMatch(/From Google/);
    expect(src).not.toMatch(/ON GOOGLE/i);
    expect(src).toContain("pinToneColor");
    expect(src).toContain("predictions.map");
  });
});

describe("viewportCenter", () => {
  it("averages a normal box and wraps the dateline", () => {
    const box = viewportCenter({
      south: 25,
      west: -100.4,
      north: 26,
      east: -100.2,
    });
    expect(box.lat).toBeCloseTo(25.5);
    expect(box.lng).toBeCloseTo(-100.3);
    const wrap = viewportCenter({
      south: 0,
      west: 179.8,
      north: 0.2,
      east: -179.8,
    });
    expect(wrap.lat).toBeCloseTo(0.1);
    expect(wrap.lng).toBeCloseTo(180);
  });
});

describe("shouldReloadNearbyCatalog", () => {
  const last = { lat: 25.5, lng: -100.3 };
  const cityBox = {
    south: 25.4,
    west: -100.4,
    north: 25.6,
    east: -100.2,
  };
  const wideBox = {
    south: 20,
    west: -110,
    north: 30,
    east: -90,
  };

  it("always loads the first paint", () => {
    expect(shouldReloadNearbyCatalog(null, last, cityBox, 5)).toBe(true);
  });

  it("ignores a ~110 m nudge at city zoom", () => {
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.501, lng: -100.3 }, cityBox, 5),
    ).toBe(false);
  });

  it("reloads after a neighborhood-scale pan", () => {
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.554, lng: -100.3 }, cityBox, 5),
    ).toBe(true);
  });

  it("uses 20% of visible width when zoomed out", () => {
    expect(nearbyReloadThresholdKm(100, 5)).toBe(20);
    expect(nearbyReloadThresholdKm(10, 5)).toBe(5);
    expect(clampReloadMinKm(99)).toBe(20);
    expect(clampReloadMinKm(0.1)).toBe(0.2);
    expect(clampReloadMinKm(undefined)).toBe(0.5);
    expect(clampReloadMinSec(40)).toBe(15);
    expect(clampReloadMinSec(undefined)).toBe(2);
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.554, lng: -100.3 }, wideBox, 5),
    ).toBe(false);
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.5, lng: -96 }, wideBox, 5),
    ).toBe(true);
  });

  it("reloads after a few blocks at the 0.5 km default", () => {
    const blockBox = {
      south: 25.495,
      west: -100.305,
      north: 25.505,
      east: -100.295,
    };
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.505, lng: -100.3 },
        blockBox,
        0.5,
      ),
    ).toBe(true);
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.501, lng: -100.3 },
        blockBox,
        0.5,
      ),
    ).toBe(false);
  });

  it("needs both a far enough pan and the wait", () => {
    const far = { lat: 25.554, lng: -100.3 };
    expect(
      shouldReloadNearbyCatalog(last, far, cityBox, 5, {
        fetchedAtMs: 1_000,
        nowMs: 1_500,
        minSec: 2,
      }),
    ).toBe(false);
    expect(
      shouldReloadNearbyCatalog(last, far, cityBox, 5, {
        fetchedAtMs: 1_000,
        nowMs: 3_000,
        minSec: 2,
      }),
    ).toBe(true);
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.501, lng: -100.3 },
        cityBox,
        5,
        {
          fetchedAtMs: 1_000,
          nowMs: 10_000,
          minSec: 2,
        },
      ),
    ).toBe(false);
  });
});

const RAIL_PLACE = {
  id: "p1",
  slug: "cosmo",
  name: "Cosmo San Pedro",
  category: "Nightclub",
  price_level: 4,
  currency: "MXN",
  lat: 25.67,
  lng: -100.3,
  address: null,
  closes_at: null,
  phone: null,
  pitch: null,
  story: null,
  photos: [],
  website_url: null,
  instagram_url: null,
  facebook_url: null,
  whatsapp_url: null,
  opentable_url: null,
  resy_url: null,
  uber_eats_url: null,
  x_url: null,
  threads_url: null,
  reddit_url: null,
  didi_food_url: null,
  google_maps_url: null,
  created_at: "2026-08-01T00:00:00Z",
} as Place;

const railProps = {
  railCollapsed: false,
  railIndex: 0,
  selectedId: null as string | null,
  railScrollRef: { current: null },
  onShowRail: () => {},
  onHideRail: () => {},
  onRailScroll: () => {},
  onSelectPlace: () => {},
  onOpenPlace: () => {},
  setRailCardRef: () => {},
};

describe("Search catalog reload UI", () => {
  it("shows a skeleton rail on first load, not a tiny pill", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay {...railProps} places={[]} catalogLoading />,
    );
    expect(html).toContain("Finding nearby");
    expect(html).toContain("aria-busy");
    expect(html).not.toContain("Finding places around you");
  });

  it("keeps the cards and says Updating nearby while the catalog reloads", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay {...railProps} places={[RAIL_PLACE]} catalogLoading />,
    );
    expect(html).toContain("Updating nearby");
    expect(html).toContain("Cosmo San Pedro");
    expect(html).toContain("opacity-55");
  });

  it("empty nearby state has no Adjust and no Reset control", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay {...railProps} places={[]} />,
    );
    expect(html).toContain("No places to show here yet");
    expect(html).not.toContain("Adjust");
    expect(html).not.toContain("filters");
  });
});

describe("Search catalog rail pages 80% wide with neighbor peeks and snaps", () => {
  it("uses 80/10/10 snap pages, not a 288px peek strip or a full-bleed card", () => {
    const overlay = read("search-catalog-overlays.tsx");
    const card = read("SearchRailCard.tsx");
    const client = read("SearchClient.tsx");
    const loading = read("../../../app/(shell)/(discovery)/search/loading.tsx");
    expect(overlay).toContain("snap-x snap-mandatory");
    expect(overlay).toContain("w-4/5 shrink-0 snap-center");
    expect(overlay).toContain("px-3");
    expect(overlay).toContain("first:ml-[10%] last:mr-[10%]");
    expect(overlay).not.toContain("w-[288px]");
    expect(overlay).not.toContain("w-full shrink-0 snap-start");
    expect(overlay).not.toMatch(/flex gap-2 overflow-x-auto/);
    expect(card).toContain("flex w-full items-stretch");
    expect(card).toContain("ring-inset");
    expect(card).not.toContain("w-[288px]");
    expect(client).toContain("el.clientWidth * 0.8");
    expect(client).toContain("railCenterIndex");
    expect(client).toContain("setSelectedId(id)");
    expect(client).toContain("defaultRailSelection");
    expect(client).toContain("railSelectedId");
    // The guard is a pure function now, not a comment.
    expect(client).toContain("shouldCenterRailCard(idx, railIndex");
    expect(client).toContain("centerOnSelect");
    expect(client).not.toContain("setSelectedId(next)");
    expect(client).toContain('inline: "center"');
    expect(client).not.toContain("RAIL_STRIDE");
    expect(client).not.toContain("w-[288px]");
    expect(loading).toContain("w-4/5 shrink-0 snap-center");
    expect(loading).toContain("px-3");
    expect(loading).toContain("first:ml-[10%] last:mr-[10%]");
    expect(loading).not.toContain("w-[288px]");
  });

  it("bleeds a square rail photo to the card edge with no inner frame", () => {
    const card = read("SearchRailCard.tsx");
    const overlay = read("search-catalog-overlays.tsx");
    expect(card).toContain(
      "bg-muted relative aspect-square h-full w-auto shrink-0 overflow-hidden",
    );
    expect(card).toContain("overflow-hidden rounded-2xl border");
    expect(card).toContain('className="border-0 object-cover outline-none"');
    expect(card).not.toContain("rounded-xl");
    expect(card).not.toContain(" w-20 ");
    expect(card).not.toMatch(
      /aspect-square[^"]*\b(?:border|ring|rounded-xl)\b/,
    );
    expect(overlay).toContain(
      "aspect-square h-full w-auto shrink-0 rounded-none",
    );
    const html = renderToStaticMarkup(
      <RailCard
        place={RAIL_PLACE}
        selected={false}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain("aspect-square");
    expect(html).toContain("h-full");
    expect(html).not.toMatch(/aspect-square[^"]*\bborder\b/);
    expect(html).not.toMatch(/aspect-square[^"]*\brounded-xl\b/);
  });

  it("keeps every rail card the same height when rows are missing", () => {
    const card = read("SearchRailCard.tsx");
    const overlay = read("search-catalog-overlays.tsx");
    const loading = read("../../../app/(shell)/(discovery)/search/loading.tsx");
    expect(card).toContain('RAIL_CARD_HEIGHT_CLASS = "h-24"');
    expect(card).toContain("grid-rows-[1.25rem_repeat(3,1rem)]");
    expect(overlay).toContain("RAIL_CARD_HEIGHT_CLASS");
    expect(loading).toContain("h-24");
    expect(loading).not.toContain("h-[88px]");

    const sparse = renderToStaticMarkup(
      <RailCard
        place={RAIL_PLACE}
        selected={false}
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    );
    const full = renderToStaticMarkup(
      <RailCard
        place={{
          ...RAIL_PLACE,
          id: "p2",
          name: "Cabaret Social Room",
          category_label: "Nightclub",
          zone: "Del Valle",
          google_rating: 4.3,
          distance_km: 0.9,
          open_now: false,
          opens_at: "21:00",
        }}
        selected
        onSelect={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(sparse).toContain("h-24");
    expect(full).toContain("h-24");
    expect(sparse).toContain("grid-rows-[1.25rem_repeat(3,1rem)]");
    expect(full).toContain("grid-rows-[1.25rem_repeat(3,1rem)]");
  });

  it("renders one 80% skeleton page with 10% side pads, not a 288px strip", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay {...railProps} places={[]} catalogLoading />,
    );
    expect(html).toContain("Finding nearby");
    expect(html).toContain("snap-center");
    expect(html).toContain("w-4/5");
    expect(html).not.toContain("w-[288px]");
  });
});

describe("Name search is ONE search after Word's idle seconds (MESITA-2322)", () => {
  it("calls suggest-places once, Deep, after the EF's idle wait", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("DEFAULT_IDLE_MS");
    expect(src).toContain("idleMsRef.current");
    expect(src).toContain('"deep"');
    expect(src).not.toContain('"fast"');
    expect(src).not.toContain("FAST_DEBOUNCE_MS");
    expect(src).not.toContain("DEEP_IDLE_MS");
  });

  it("takes the idle seconds from every answer", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(/if \(idleSec !== null\) idleMsRef\.current = Math\.round\(idleSec \* 1000\)/);
  });
});

describe("rail center is the selected place", () => {
  it("railCenterIndex snaps to the nearest page and clamps", () => {
    expect(railCenterIndex(0, 320, 5)).toBe(0);
    expect(railCenterIndex(160, 320, 5)).toBe(1);
    expect(railCenterIndex(480, 320, 5)).toBe(2);
    expect(railCenterIndex(2000, 320, 5)).toBe(4);
    expect(railCenterIndex(100, 0, 5)).toBe(0);
    expect(railCenterIndex(100, 320, 0)).toBe(0);
  });

  it("a tap centres the card, a flick that already parked does not", () => {
    // The bug: opening a collapsed rail leaves railIndex stale at 0, so
    // card 0 read as already-centred and a pin tap scrolled nothing.
    expect(shouldCenterRailCard(0, 0, true)).toBe(true);
    expect(shouldCenterRailCard(0, 0, false)).toBe(false);
    expect(shouldCenterRailCard(3, 0, false)).toBe(true);
    expect(shouldCenterRailCard(3, 3, true)).toBe(true);
    // A card the catalog no longer holds is never centred.
    expect(shouldCenterRailCard(-1, 0, true)).toBe(false);
    expect(shouldCenterRailCard(-1, 0, false)).toBe(false);
  });

  it("an overlay pin never opens the rail — it has no card there", () => {
    const client = read("SearchClient.tsx");
    // select-google / select-mesita-overlay must NOT setRailCollapsed(false):
    // defaultRailSelection would fall back to card 0 and the guest who
    // tapped B would watch A light up.
    const overlay = client.slice(
      client.indexOf('case "select-google"'),
      client.indexOf('case "select-mesita-catalog"'),
    );
    expect(overlay).toContain("setSelectedId(pin.id)");
    expect(overlay).not.toContain("setRailCollapsed(false)");
    // A catalog pin still opens it and asks for the centring.
    const catalogCase = client.slice(
      client.indexOf('case "select-mesita-catalog"'),
      client.indexOf('case "noop"'),
    );
    expect(catalogCase).toContain("centerOnSelect.current = true");
    expect(catalogCase).toContain("setRailCollapsed(false)");
  });

  it("defaultRailSelection keeps a live id and falls back to the first card", () => {
    expect(defaultRailSelection(["a", "b"], null)).toBe("a");
    expect(defaultRailSelection(["a", "b"], "b")).toBe("b");
    expect(defaultRailSelection(["a", "b"], "gone")).toBe("a");
    expect(defaultRailSelection([], "a")).toBe(null);
  });
});

describe("catalogIsStale", () => {
  const last = { lat: 25.5, lng: -100.3 };

  it("is false before the first fetch and for a 110 m nudge", () => {
    expect(catalogIsStale(null, last)).toBe(false);
    expect(catalogIsStale(last, { lat: 25.501, lng: -100.3 })).toBe(false);
  });

  it("is true after a couple of city blocks", () => {
    expect(catalogIsStale(last, { lat: 25.503, lng: -100.3 })).toBe(true);
  });
});

describe("a Google-only result opens through get-or-create, never a preview or a photo (MESITA-2298)", () => {
  it("has no preview sheet, no client-side Places call, and one create call site", () => {
    const client = read("SearchClient.tsx");
    expect(client).toContain("openGoogleOnly");
    expect(client).toContain("openGoogleProfile");
    expect(client).not.toContain("GooglePlaceSheet");
    expect(client).not.toContain("fetchGooglePlacePreview");
    expect(client).not.toContain("setPreviewOpen");
    expect(client).not.toContain("places.googleapis.com");
    // The explicit open goes to the opening screen at once (MESITA-2311);
    // Search itself never creates. The ONE place that creates is the opening
    // screen's getOrCreateGooglePlace, reached only from that screen.
    expect(client).not.toContain("apiCreateProject(");
    const open = client.slice(
      client.indexOf("const openGoogleProfile"),
      client.indexOf("const openGoogleOnly"),
    );
    // The card rides along: the opening screen draws it as the profile's
    // first draft (MESITA-2307).
    expect(open).toContain("openGooglePlace(");
    const opener = readFileSync(
      join(SEARCH_DIR, "../../../lib/use-open-google-place.ts"),
      "utf8",
    );
    expect(opener.match(/apiCreateProject\(/g)?.length).toBe(1);
    // One tap never creates: a Google-only open needs the RAW selection to
    // match, else the tap selects (MESITA-2305).
    const openPlace = client.slice(
      client.indexOf("const handleOpenPlace"),
      client.indexOf("const railSelectedId"),
    );
    expect(openPlace).toContain("if (selectedId !== place.id)");
    expect(openPlace).toContain("handleSelectPlace(place)");
    expect(openPlace.indexOf("if (selectedId !== place.id)")).toBeLessThan(
      openPlace.indexOf("openGoogleOnly(google, place)"),
    );
    for (const gone of ["GooglePlaceSheet.tsx"]) {
      expect(existsSync(join(SEARCH_DIR, gone)), gone).toBe(false);
    }
    expect(
      existsSync(join(SEARCH_DIR, "../../../lib/google-place-preview.ts")),
    ).toBe(false);
    expect(read("SearchRailCard.tsx")).not.toContain("places.googleapis.com");
  });
});

describe("every searchbar pick anchors the map (MESITA-1405)", () => {
  it("routes BOTH panel picks through one anchoring handler, never the modal", () => {
    const client = read("SearchClient.tsx");
    // One handler for both entities — Mesita and Google rows anchor alike.
    expect(client).toContain("onPick={handleBarPick}");
    // The early return that opened the modal the moment a row carried a
    // mesitaSlug/mesitaId is the line that went.
    expect(client).not.toMatch(
      /if \(prediction\.mesitaSlug \?\? prediction\.mesitaId\) \{\s*openMesitaProfileFromPrediction/,
    );
    // A pick is a camera move + a forced reload + card one.
    expect(client).toContain("const anchorMapTo = (");
    expect(client).toContain(
      "anchorMapTo({ lat: anchorRow.lat, lng: anchorRow.lng }, anchorRow)",
    );
    expect(client).toMatch(
      /anchorMapTo[\s\S]{0,400}forceNextLoad\.current = true/,
    );
    expect(client).toContain("cameraAnchor={anchor?.camera ?? null}");
    // The modal and the Google-only open moved to the SECOND tap — the pin /
    // rail-card open paths — and stayed off the bar pick.
    expect(client).toContain("openGoogleOnly");
    expect(client).toContain("openMesitaProfileFromPrediction");
    const barPick = client.slice(
      client.indexOf("const handleBarPick"),
      client.indexOf("const handleOpenPlace"),
    );
    expect(barPick).not.toContain("openGoogleOnly");
    expect(barPick).not.toContain("openGoogleProfile");
    // The no-coordinates Mesita row keeps the direct-open fallback; that
    // is the only router.push a bar pick may reach.
    expect(barPick.match(/router\.push/g)?.length).toBe(1);
  });

  it("resolves a Location on PICK — one Details call, viewport decides zoom", () => {
    const client = read("SearchClient.tsx");
    const barPick = client.slice(
      client.indexOf("const handleBarPick"),
      client.indexOf("const handleOpenPlace"),
    );
    expect(barPick).toContain('prediction.kind === "location"');
    expect(barPick).toContain("apiResolveLocationAnchor");
    expect(barPick).toContain("anchorViewportBounds(resolved.viewport)");
    // Never resolved while typing: the suggest debounce effect stays clean.
    const debounce = client.slice(
      client.indexOf("const fast = window.setTimeout"),
      client.indexOf("const searchPins"),
    );
    expect(debounce).not.toContain("apiResolveLocationAnchor");
    // The camera side: a bounds anchor FITS (city wide, neighbourhood
    // close); a place anchor pans.
    const map = read("SearchMap.tsx");
    expect(map).toContain("function AnchorCamera");
    expect(map).toContain("map.fitBounds(anchor.bounds)");
    expect(map).toMatch(/AnchorCamera[\s\S]{0,600}noteProgrammaticCamera\(\)/);
  });

  it("the card-0 fallback rings but never pans — only explicit picks do", () => {
    const client = read("SearchClient.tsx");
    const map = read("SearchMap.tsx");
    // railSelectedId (ring + zIndex) and panTargetId (camera) are split:
    // defaultRailSelection's fallback would otherwise snap the view to the
    // closest place after every reload — fatal right after a Location
    // anchor fits a whole city.
    expect(client).toContain("panTargetId={selectedId}");
    expect(map).toMatch(/<PanTo lat=\{panLat\} lng=\{panLng\}/);
    expect(map).not.toContain("<PanTo lat={selectedLat}");
    // A Location pick clears the lingering explicit selection too.
    expect(client).toMatch(/\} else \{[\s\S]{0,220}setSelectedId\(null\);/);
  });

  it("prepends the pick after the operator's cap — it never vetoes the pick", () => {
    const client = read("SearchClient.tsx");
    const memo = client.slice(
      client.indexOf("const catalog = useMemo"),
      client.indexOf("}, [nearby, anchor, distanceCenter]);"),
    );
    // The cap is the EF's now (MESITA-1699), so the memo has one job: put the
    // picked place first. It must still not re-cut what the server sent.
    expect(memo).toContain("prependAnchorPlace(nearby, anchorRow)");
    expect(memo).not.toContain("takeMapResultLimit");
    // A thin operator ring still cannot hide the place the guest typed.
    expect(memo.indexOf("anchorRow")).toBeLessThan(
      memo.indexOf("prependAnchorPlace"),
    );
  });
});

describe("a Location wears the location icon, never a place tone (MESITA-1404)", () => {
  const rows: PlacePrediction[] = [
    {
      placeId: "loc-1",
      mainText: "Ciudad de México",
      secondaryText: "CDMX, Mexico",
      state: "not_in_mesita",
      kind: "location",
      locationType: "locality",
    },
    {
      placeId: "ven-1",
      mainText: "Taquería Nueva",
      secondaryText: "Calle Falsa 123",
      state: "not_in_mesita",
    },
  ];

  it("marks the Location row with the icon and keeps the place dot untouched", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPanel
        query="ciudad"
        searching={false}
        searchError={null}
        predictions={rows}
        addStates={{}}
        onPick={() => {}}
      />,
    );
    expect(html).toContain("lucide-map-pin");
    // The spoken half of the mark names the ENTITY, not a missing profile.
    expect(html).toContain("Ciudad de México, CDMX, Mexico, City");
    // The place row keeps its gray dot and its place answer.
    expect(html).toContain("No profile yet");
    // Exactly ONE place dot renders — the city carries none, so the two
    // semantics never share a mark (no third colour, no shared gray).
    expect(html.match(/background-color:#9ca3af/g)?.length).toBe(1);
    // No source labels, no badge, no section header — the icon says it.
    expect(html).not.toContain(">City<");
    expect(html).not.toContain(">Location<");
    expect(html).not.toContain("From Google");
  });

  it("speaks a Created place as a basic profile, never as not-enriched (MESITA-2154, MESITA-2298)", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPanel
        query="strana"
        searching={false}
        searchError={null}
        predictions={[
          {
            placeId: "ChIJ-created",
            mainText: "Strana",
            secondaryText: "Monterrey",
            state: "web_listed",
            enriched: false,
            mesitaId: "m-created",
          },
          {
            placeId: "ChIJ-enriched",
            mainText: "Casa",
            secondaryText: "Monterrey",
            state: "web_listed",
            enriched: true,
            mesitaId: "m-enriched",
          },
        ]}
        addStates={{}}
        onPick={() => {}}
      />,
    );
    expect(html).toContain("Strana, Monterrey, Basic Mesita profile");
    expect(html).toContain("Casa, Monterrey, Mesita Selected");
    expect(html).not.toContain("No profile yet");
    expect(html).not.toMatch(/enriched/i);
  });

  it("branches on kind BEFORE the tone function is asked anything", () => {
    const panel = read("SearchResultsPanel.tsx");
    const branchAt = panel.indexOf('prediction.kind === "location"');
    expect(branchAt).toBeGreaterThan(-1);
    expect(branchAt).toBeLessThan(
      panel.indexOf("predictionPinTone(prediction)"),
    );
  });

  it("buildSearchMapPins skips Locations — a camera destination, never a pin", () => {
    // Even WITH coordinates (post-anchor rows), a Location draws no marker.
    expect(
      buildSearchMapPins(
        [
          {
            placeId: "loc-1",
            mainText: "CDMX",
            kind: "location",
            lat: 19.4,
            lng: -99.1,
          },
        ],
        [],
      ),
    ).toBe(null);
  });

  it("locationTypeLabel names the entity, with Location as the floor", () => {
    expect(locationTypeLabel("locality")).toBe("City");
    expect(locationTypeLabel("administrative_area_level_1")).toBe("State");
    expect(locationTypeLabel("country")).toBe("Country");
    expect(locationTypeLabel("neighborhood")).toBe("Neighborhood");
    expect(locationTypeLabel("political")).toBe("Location");
    expect(locationTypeLabel(undefined)).toBe("Location");
  });
});

describe("anchor helpers", () => {
  const GOOGLE_PICK: PlacePrediction = {
    placeId: "ChIJx",
    mainText: "Taquería Nueva",
    secondaryText: "Calle Falsa 123",
    state: "not_in_mesita",
    lat: 25.66,
    lng: -100.31,
  };

  it("anchorPlaceFromPrediction mirrors the Google-stub shape", () => {
    const stub = anchorPlaceFromPrediction(GOOGLE_PICK)!;
    expect(stub.id).toBe("g:ChIJx");
    expect(stub.slug).toBe("ChIJx");
    expect(stub.google_place_id).toBe("ChIJx");
    expect(stub.googleOnly).toBe(true);
    expect(stub.from_google).toBe(true);
    expect(stub.name).toBe("Taquería Nueva");
    expect(stub.photos).toEqual([]);
  });

  it("a Google-only Text Search pick's draft carries its card (MESITA-2325)", () => {
    const stub = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      card: {
        id: "g:other",
        category: "taco_restaurant",
        category_label: "Taco restaurant",
        price_level: 1,
        google_stars_overall: 4.7,
        google_review_count: 320,
        open_now: true,
        phone: "+52 81 1234 5678",
        google_maps_url: "https://maps.google.com/?cid=9",
        lat: 0,
        lng: 0,
      },
    })!;
    expect(stub.id).toBe("g:ChIJx");
    expect(stub.lat).toBe(GOOGLE_PICK.lat);
    expect(stub.category_label).toBe("Taco restaurant");
    expect(stub.price_level).toBe(1);
    expect(stub.google_review_count).toBe(320);
    expect(stub.open_now).toBe(true);
    expect(stub.phone).toBe("+52 81 1234 5678");
    expect(stub.google_maps_url).toBe("https://maps.google.com/?cid=9");
  });

  it("a Mesita row ignores any card", () => {
    const row = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      mesitaId: "m-1",
      card: { category_label: "Should not show" },
    })!;
    expect(row.category_label).toBeNull();
  });

  it("anchorPlaceFromPrediction keeps Mesita identity for stamped rows", () => {
    const row = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      state: "web_listed",
      mesitaId: "m-1",
      mesitaSlug: "taqueria-nueva",
      enriched: true,
    })!;
    expect(row.id).toBe("m-1");
    expect(row.slug).toBe("taqueria-nueva");
    expect(row.enriched).toBe(true);
    expect(row.googleOnly).toBeUndefined();
  });

  it("anchorPlaceFromPrediction refuses a row without coordinates", () => {
    expect(
      anchorPlaceFromPrediction({ ...GOOGLE_PICK, lat: null, lng: null }),
    ).toBe(null);
    expect(
      anchorPlaceFromPrediction({
        ...GOOGLE_PICK,
        lat: undefined,
        lng: undefined,
      }),
    ).toBe(null);
  });

  it("prependAnchorPlace: inside the N stays N unique, outside becomes N + 1", () => {
    const a = { ...RAIL_PLACE, id: "a" } as Place;
    const b = { ...RAIL_PLACE, id: "b" } as Place;
    const outside = { ...RAIL_PLACE, id: "c" } as Place;
    // Outside the capped set: 21 is correct, not a bug.
    expect(prependAnchorPlace([a, b], outside).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    // Inside it: the catalog's own richer row wins the front slot.
    const richer = {
      ...RAIL_PLACE,
      id: "b",
      photos: ["https://x/p.jpg"],
    } as Place;
    const woven = prependAnchorPlace([a, richer], b);
    expect(woven.map((p) => p.id)).toEqual(["b", "a"]);
    expect(woven[0].photos).toEqual(["https://x/p.jpg"]);
    expect(prependAnchorPlace([a, b], null)).toEqual([a, b]);
  });

  it("prependAnchorPlace joins a stub to the catalog row on the Google spine", () => {
    const stub = anchorPlaceFromPrediction(GOOGLE_PICK)!;
    const catalogStub = {
      ...RAIL_PLACE,
      id: "g:ChIJx",
      slug: "ChIJx",
      googleOnly: true,
      from_google: true,
    } as Place;
    const woven = prependAnchorPlace(
      [{ ...RAIL_PLACE, id: "a" } as Place, catalogStub],
      stub,
    );
    expect(woven.map((p) => p.id)).toEqual(["g:ChIJx", "a"]);
  });

  it("anchorSurvivesReload keeps its own load and drops real travel", () => {
    const at = { lat: 25.66, lng: -100.31 };
    expect(anchorSurvivesReload(at, { lat: 25.66, lng: -100.31 })).toBe(true);
    // Under the 0.5 km drag-reload floor, so a pick's own load never clears.
    expect(ANCHOR_DROP_KM).toBeLessThan(0.5);
    expect(anchorSurvivesReload(at, { lat: 25.7, lng: -100.31 })).toBe(false);
    expect(anchorSurvivesReload({ lat: null, lng: null }, at)).toBe(false);
  });

  it("anchorViewportBounds converts the wire viewport and passes null through", () => {
    expect(
      anchorViewportBounds({
        low: { lat: 19.18, lng: -99.32 },
        high: { lat: 19.59, lng: -98.96 },
      }),
    ).toEqual({ south: 19.18, west: -99.32, north: 19.59, east: -98.96 });
    expect(anchorViewportBounds(null)).toBe(null);
  });
});
