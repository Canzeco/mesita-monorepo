import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RailCard } from "@/components/consumer/search/SearchRailCard";
import { SearchResultsPanel } from "@/components/consumer/search/SearchResultsPanel";
import { SearchFilterRow } from "@/components/consumer/search/SearchFilterRow";
import {
  buildSearchMapPins,
  locationTypeLabel,
} from "@/lib/search-membership";
import {
  EmptySearchPrompt,
  SearchRailOverlay,
} from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { SearchMapFilters } from "@/components/consumer/search/SearchMapFilters";
import { SearchPlacesScope } from "@/components/consumer/search/SearchPlacesScope";
import { SearchResultLimit } from "@/components/consumer/search/SearchResultLimit";
import { SearchScopeSheet } from "@/components/consumer/search/SearchScopeSheet";
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

// Design §D + Product Rules §C: Search is the map plus a results panel whose
// HEIGHT FITS CONTENT. A fixed tall empty panel (h-[70%] and friends) is the
// named regression — short lists must leave the map visible below.

describe("Search overlays never use a fixed-height empty panel", () => {
  it("does not hardcode h-[70%] on the prompt, results, or client", () => {
    const fixedHeight = /(?<!max-)h-\[70%\]/;
    expect(read("search-catalog-overlays.tsx")).not.toMatch(fixedHeight);
    expect(read("SearchResultsPanel.tsx")).not.toMatch(fixedHeight);
    expect(read("SearchClient.tsx")).not.toMatch(fixedHeight);
  });

  it("renders the empty prompt as content, not a tall sheet", () => {
    const html = renderToStaticMarkup(<EmptySearchPrompt />);
    expect(html).toContain("Where to today?");
    expect(html).not.toContain("h-[70%]");
    expect(html).not.toContain("absolute");
  });
});

describe("SearchBar scope affordance", () => {
  it("hides the country + location chip when Visit omits onOpenScope", () => {
    const html = renderToStaticMarkup(
      <SearchBar
        query=""
        showClear={false}
        onQueryChange={() => {}}
        onClear={() => {}}
      />,
    );
    expect(html).not.toContain("any country");
    expect(html).not.toContain("Filters");
  });

  it("shows the country flag and a compass when a host passes onOpenScope", () => {
    const html = renderToStaticMarkup(
      <SearchBar
        query=""
        showClear={false}
        onQueryChange={() => {}}
        onClear={() => {}}
        onOpenScope={() => {}}
        countryCode="MX"
        locationSet
      />,
    );
    expect(html).toContain("🇲🇽");
    expect(html).toContain("MX");
    expect(html).toContain("location set");
    expect(html).toContain("lucide-compass");
    expect(html).not.toContain("Filters");
    expect(html).not.toContain("SlidersHorizontal");
  });

  it("renders the Any globe when country is unset", () => {
    const html = renderToStaticMarkup(
      <SearchBar
        query=""
        showClear={false}
        onQueryChange={() => {}}
        onClear={() => {}}
        onOpenScope={() => {}}
        countryCode={null}
        locationSet={false}
      />,
    );
    expect(html).toContain("🌐");
    expect(html).toContain("any country");
    expect(html).toContain("location not set");
  });
});

describe("SearchFilterRow", () => {
  // IT CARRIES ITS LABEL NOW (Pato, 2026-09-01: "filters button must be more
  // visible"), reversing the icon-only rule this suite used to pin. A 48px
  // translucent disc on a mostly-white basemap was camouflage, and the count
  // badge — the only thing that made it pop — appears only once a filter is
  // already on, i.e. least visible exactly when it has not been found yet.
  it("shows a labelled pill, and goes primary-filled when filters are on", () => {
    const rest = renderToStaticMarkup(
      <SearchFilterRow count={0} onOpenFilters={() => {}} />,
    );
    expect(rest).toContain("lucide-sliders-horizontal");
    expect(rest).toContain("Filter places");
    expect(rest).toMatch(/>\s*Filters\s*</);
    expect(rest).toContain("bg-card");
    expect(rest).not.toContain("bg-primary");
    // The sheet still owns every actual filter — none of them leak onto canvas.
    expect(rest).not.toContain("Restaurants");
    expect(rest).not.toContain("Bars");
    expect(rest).not.toContain("Now");
    expect(rest).not.toContain("Visit");
    expect(rest).not.toContain("\u{1f1f2}\u{1f1fd}");

    const on = renderToStaticMarkup(
      <SearchFilterRow count={3} onOpenFilters={() => {}} />,
    );
    expect(on).toContain("3 applied");
    expect(on).toContain("bg-primary");
    expect(on).toContain(">3<");
    expect(read("SearchFilterRow.tsx")).not.toContain("PLACE_FAMILIES");
    expect(read("SearchFilterRow.tsx")).not.toContain("onOpenScope");
  });
});

describe("SearchMapFilters", () => {
  it("shows Super Category, the two Places sets, then How many — dense, no scroll", () => {
    const html = renderToStaticMarkup(
      <SearchMapFilters onClose={() => {}} count={4} />,
    );
    expect(html.indexOf("Super Category")).toBeLessThan(html.indexOf("Places"));
    expect(html.indexOf("Mesita Places")).toBeLessThan(html.indexOf("How many"));
    expect(html).toContain("How many");
    // 4 places under a cap of 20: the line states BOTH so it cannot
    // disagree with the button one row below.
    expect(html).toContain("Showing 4 of up to 20 closest.");
    expect(html).not.toContain("Closest 20 places.");
    expect(html).toContain("role=\"radiogroup\"");
    // TWO sets only — Partners is a paint, never a scope.
    expect(html).toContain("Mesita Places");
    expect(html).toContain("Google Places");
    expect(html).not.toContain("Mesita Partners");
    expect(html).not.toContain("All Mesita Places");
    expect(html).not.toContain("All Google Places");
    // The dots wear the pin colours: Mesita red, Google gray.
    expect(html).toContain("background-color:#ff2357");
    expect(html).toContain("background-color:#9ca3af");
    expect(html).toContain(">20<");
    expect(html).toContain(">40<");
    expect(html).toContain(">60<");
    // The Venn is gone — dense sheet, every option directly visible.
    expect(html).not.toContain("viewBox=\"0 0 104 104\"");
    expect(html).not.toContain("overflow-y-auto");
    expect(html).toContain(
      'aria-checked="true" aria-label="Mesita Places only"',
    );
    expect(html).toContain(
      'aria-checked="true" aria-label="Closest 20 places"',
    );
    expect(html.match(/role="radio"/g)?.length).toBe(5);
    // Mesita Places is the default scope — nothing to warn about yet.
    expect(html).not.toContain("not curated by Mesita");
    expect(html).not.toContain('type="range"');
    expect(html).toContain("Super Category");
    expect(html).toContain("Restaurants");
    expect(html).toContain("Bars &amp; Nightlife");
    expect(html).toContain("Wellness &amp; Beauty");
    // SEVEN pills — ❓ Undefined is a bookkeeping bucket, not an appetite.
    expect(html).not.toContain("Undefined");
    expect(html).toContain("Show 4 places");
    expect(html).not.toContain("Not on Mesita");
    expect(html).not.toContain("Created");
    expect(html).not.toContain("Requested");
    expect(html).not.toContain("Enriched");
    expect(html).not.toContain("Partnered");
    expect(html).not.toContain("Promoted");
    expect(html).not.toContain(">Category<");
    expect(html).not.toContain("Types");
    expect(html).not.toContain("Nightclub");
    expect(html).not.toContain("Taco Restaurant");
    expect(html).not.toContain("Distance tolerance");
    expect(html).not.toContain("Anytime");
    expect(html).not.toContain("I want to");
    expect(html).not.toContain("Prioritize");
  });
});

describe("SearchPlacesScope", () => {
  it("is two radio pills wearing the pin colours — no Venn, no Partners scope", () => {
    const src = read("SearchPlacesScope.tsx");
    expect(src).not.toContain("annulusPath");
    expect(src).not.toContain("VENN_LAYERS");
    expect(src).toContain("Partners is a paint, never a scope");
    // Selected is a FILL — two white pills are not a selection.
    expect(src).toContain("bg-foreground text-background");
    expect(src).not.toContain("bg-transparent");

    const html = renderToStaticMarkup(
      <SearchPlacesScope power={1} onPower={() => {}} />,
    );
    expect(html.match(/role="radio"/g)?.length).toBe(2);
    expect(html).toContain('aria-checked="true" aria-label="Mesita Places only"');
    expect(html).toContain(
      'aria-checked="false" aria-label="Mesita Places and Google Places"',
    );
    expect(html).toContain("background-color:#ff2357");
    expect(html).toContain("background-color:#9ca3af");
    // The retired partner scope colour never renders here — yellow lives on
    // the map pins.
    expect(html).not.toContain("#ffc400");
    // Mesita Places is curated, so the scope that IS curated says nothing.
    expect(html).not.toContain("not curated by Mesita");
    const google = renderToStaticMarkup(
      <SearchPlacesScope power={2} onPower={() => {}} />,
    );
    // Leaving the curated set warns, in the box, every time.
    expect(google).toContain("Google Places are not curated by Mesita");
    expect(google).toContain("quality varies");
    expect(google).toContain('role="note"');
    expect(google).toContain(
      'aria-checked="true" aria-label="Mesita Places and Google Places"',
    );
  });
});

describe("SearchResultLimit — the cap and the reality in one line", () => {
  it("names the cap when the catalog fills it, the shortfall when it does not", () => {
    // The bug: "Closest 60 places." sitting above a button reading
    // "Show 20 places" reads as a broken control. Google's Nearby call
    // caps at 20/call, so the gap is the normal case at Google scope.
    const short = renderToStaticMarkup(
      <SearchResultLimit limit={60} onLimit={() => {}} count={20} />,
    );
    expect(short).toContain("Showing 20 of up to 60 closest.");
    expect(short).not.toContain("Closest 60 places.");

    const full = renderToStaticMarkup(
      <SearchResultLimit limit={20} onLimit={() => {}} count={20} />,
    );
    expect(full).toContain("Closest 20 places.");

    // Over-full (a stale catalog mid-refetch) still reads as the cap.
    const over = renderToStaticMarkup(
      <SearchResultLimit limit={20} onLimit={() => {}} count={57} />,
    );
    expect(over).toContain("Closest 20 places.");

    // Loading: no count yet, so promise nothing but the cap.
    const loading = renderToStaticMarkup(
      <SearchResultLimit limit={40} onLimit={() => {}} count={null} />,
    );
    expect(loading).toContain("Closest 40 places.");
  });
});

describe("SearchResultLimit", () => {
  it("offers only 20, 40, and 60 as exclusive radios", () => {
    const html = renderToStaticMarkup(
      <SearchResultLimit limit={40} onLimit={() => {}} />,
    );
    expect(html.match(/role="radio"/g)?.length).toBe(3);
    expect(html).toContain("Closest 40 places.");
    expect(html).toContain('aria-checked="true" aria-label="Closest 40 places"');
    expect(html).toContain('aria-checked="false" aria-label="Closest 20 places"');
    expect(html).toContain('aria-checked="false" aria-label="Closest 60 places"');
    expect(html).toContain(">20<");
    expect(html).toContain(">40<");
    expect(html).toContain(">60<");
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('type="number"');
  });
});


describe("SearchScopeSheet country pills", () => {
  const sheet = (
    <SearchScopeSheet
      country="MX"
      locationSet
      locating={false}
      onCountry={() => {}}
      onUseLocation={() => {}}
      onClearLocation={() => {}}
      onClose={() => {}}
    />
  );

  it("keeps Any as the first, unrestricted option", () => {
    const html = renderToStaticMarkup(sheet);
    const anyAt = html.indexOf("🌐 Any");
    const mxAt = html.indexOf("🇲🇽 MX");
    expect(anyAt).toBeGreaterThan(-1);
    expect(mxAt).toBeGreaterThan(anyAt);
    expect(html).toContain("Always Any");
    expect(html).not.toContain("Limits Google Autocomplete");
  });

  it("shows a flag on every listed country", () => {
    const html = renderToStaticMarkup(sheet);
    for (const chip of [
      "🇲🇽 MX",
      "🇺🇸 US",
      "🇨🇦 CA",
      "🇪🇸 ES",
      "🇦🇷 AR",
      "🇨🇱 CL",
      "🇨🇴 CO",
      "🇵🇪 PE",
    ]) {
      expect(html).toContain(chip);
    }
  });
});

describe("Search map catalog auto-reloads after distance and time", () => {
  it("loads the guest's How many, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    // How many is asked ONCE, on the Filters sheet — the fetch obeys the
    // guest's stop, never a console count knob.
    expect(read("SearchClient.tsx")).toContain("filters.resultLimit");
    expect(read("SearchClient.tsx")).not.toContain("CATALOG_NEARBY_MAX");
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
    expect(read("search-catalog-overlays.tsx")).toContain(
      "Zoom in to see this area",
    );
    expect(read("search-catalog-overlays.tsx")).toContain("Finding nearby");
    expect(read("search-catalog-overlays.tsx")).toContain("Updating nearby");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Search here");
    expect(read("SearchClient.tsx")).not.toContain("apiFetchPlacesInBbox");
    expect(read("SearchClient.tsx")).toContain("++viewportGen.current");
    expect(read("SearchClient.tsx")).not.toContain("toFixed(3)");
    expect(read("../../../lib/api/places.ts")).toContain("google: true");
    expect(read("../../../lib/api/places.ts")).toContain("searchPower");
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

describe("Search map's top row is the query bar ALONE, and Filters sits below", () => {
  it("keeps the Filters control OFF the bar's row and ON the bottom overlay", () => {
    const src = read("SearchClient.tsx");
    const overlays = read("search-catalog-overlays.tsx");
    // OFF THE TOP ROW. It escalated three times trying to be seen next to the
    // bar (icon-only -> label -> primary-filled) before coming off entirely.
    expect(src).not.toContain("SearchFilterRow");
    expect(read("SearchBar.tsx")).not.toMatch(/Search passes `onOpenScope`/);
    // ON THE BOTTOM OVERLAY, next to the count it changes.
    expect(src).toContain("onOpenFilters={() => setFiltersOpen(true)}");
    expect(src).toContain("filterCount={mapFilterCount(filters)}");
    expect(overlays).toContain("SlidersHorizontal");
    expect(overlays).toContain("filtersPill");
    // The sheet is still the body behind the pill.
    expect(src).toContain("SearchMapFilters");
    // THE STORE READ AND THE CONTROL SHIP TOGETHER, always. While the control
    // was gone this file read MAP_FILTER_DEFAULTS, because useMapFilters
    // persists in sessionStorage and a filter with no visible control is one
    // nobody can clear. Either both are here or neither is.
    expect(src).toContain("const filters = useMapFilters()");
    expect(src).toContain("resetMapFilters");
    // The assignment, not the word — the comment above it names the constant
    // to explain why the defaults were a stopgap and are not the law now.
    expect(src).not.toContain("const filters = MAP_FILTER_DEFAULTS");
    expect(src).toContain("applyMapFilters");
    expect(src).toContain("takeMapResultLimit");
    expect(src).not.toContain("SearchCategoryRow");
    expect(src).not.toContain("familyKeys={filters.familyKeys}");
    expect(src).toContain("flex min-w-0 items-center gap-2");
    expect(src).toContain("<SearchBar");
    expect(src).not.toContain("flex min-w-0 items-center justify-end");
    expect(src).not.toContain("applyDiscoveryFilters");
    expect(src).not.toContain("useDiscoveryFilters");
    expect(src).not.toContain("DiscoveryFilters");
    expect(src).not.toContain("flex-[1.15]");
    expect(src).not.toContain("SearchScopeSheet");
    expect(read("SearchBar.tsx")).not.toMatch(/Search passes `onOpenScope`/);
    expect(read("SearchMapFilters.tsx")).toContain("Places");
    expect(read("SearchMapFilters.tsx")).toContain("SearchPlacesScope");
    expect(read("SearchMapFilters.tsx")).toContain("SearchResultLimit");
    expect(read("SearchMapFilters.tsx")).toContain("How many");
    expect(read("SearchMapFilters.tsx")).toContain("Super Category");
    expect(read("SearchMapFilters.tsx")).not.toContain('label="Types"');
    expect(read("SearchMapFilters.tsx")).not.toContain('label="Category"');
    expect(read("SearchMapFilters.tsx")).not.toContain("MAP_STATUS_OPTIONS");
    expect(read("SearchMapFilters.tsx")).not.toContain("toggleMapStatus");
    expect(read("../../../lib/map-filters-engine.ts")).not.toContain(
      "Mesita Partners",
    );
    expect(read("../../../lib/map-filters-engine.ts")).toContain(
      "Mesita Places",
    );
    expect(read("../../../lib/map-filters-engine.ts")).toContain(
      "Google Places",
    );
    expect(read("../../../lib/map-filters-engine.ts")).toContain(
      "placeSearchLane",
    );
    expect(read("SearchClient.tsx")).toContain("filters.searchPower");
    expect(read("SearchClient.tsx")).toMatch(
      /filters\.searchPower[\s\S]*clearPendingReload\(\)[\s\S]*loadViewport\(lastBoxRef\.current\)/,
    );
    expect(read("SearchClient.tsx")).toContain("distance_km");
    expect(read("SearchClient.tsx")).not.toMatch(
      /applyMapFilters\(\s*predictions/,
    );
    expect(read("../../../lib/api/places.ts")).not.toMatch(
      /consumer-web-suggest-places[\s\S]*searchPower/,
    );
    expect(read("../../../lib/api/places.ts")).not.toMatch(
      /consumer-web-suggest-places[\s\S]*familyKeys/,
    );
    expect(read("../../../lib/api/places.ts")).toMatch(
      /consumer-web-list-places[\s\S]*familyKeys/,
    );
    expect(read("SearchClient.tsx")).toContain("filters.familyKeys");
    // Fast/Deep is back on the map with the search bar, so the pin has to get
    // SHARPER, not looser: SearchClient legitimately contains
    // "filters.familyKeys" for its CATALOG fetch, and a bare not.toContain
    // would now be asserting the opposite of what it means.
    //
    // The invariant is about the suggest CALL, so assert on its arguments:
    // map filters describe what to draw on the basemap, and leaking them into
    // autocomplete would silently narrow a typed name to the current chips.
    const searchSrc = read("SearchClient.tsx");
    const suggestArgs = [
      ...searchSrc.matchAll(/apiSuggestPlaces\(([\s\S]*?)\);/g),
    ].map((m) => m[1]);
    expect(suggestArgs).toHaveLength(2); // one Fast, one Deep
    expect(suggestArgs.join("\n")).toContain('"fast"');
    expect(suggestArgs.join("\n")).toContain('"deep"');
    for (const args of suggestArgs) expect(args).not.toContain("filters");
    expect(read("SearchMapFilters.tsx")).not.toContain("Distance tolerance");
    expect(read("SearchMapFilters.tsx")).not.toContain("Anytime");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Adjust");
    expect(read("search-catalog-overlays.tsx")).toContain(
      "No places match these filters",
    );
    expect(read("../../../app/(shell)/discover/search/loading.tsx")).toContain(
      "flex items-center gap-2",
    );
    expect(read("../../../app/(shell)/discover/search/loading.tsx")).not.toContain(
      "flex gap-1.5 overflow-hidden",
    );
    expect(read("../../../app/(shell)/discover/search/loading.tsx")).not.toContain(
      "mt-2 flex gap-1.5",
    );
    expect(existsSync(join(SEARCH_DIR, "SearchCategoryRow.tsx"))).toBe(false);
  });

  it("recenters the map on the location param, not only the device", () => {
    expect(read("SearchClient.tsx")).toMatch(/viewCenter=\{center\}/);
    expect(read("SearchClient.tsx")).toMatch(/locationOptOut/);
    expect(read("SearchMap.tsx")).toContain("viewCenter");
    expect(read("SearchMap.tsx")).toMatch(/Recentre target=\{lookAt\}/);
  });
});

describe("Search pin two-tap (select then open)", () => {
  it("fills pins with membership color and rings the selected one", () => {
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

  it("hides the catalog rail while a query is live", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(/\{!querying && \(\s*<SearchRailOverlay/);
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
    expect(src).toMatch(/\[supabase, trimmedQuery, searchOrigin, searchNonce\]/);
    expect(src).toContain("setSearchNonce((n) => n + 1)");
  });
});

describe("Search results are one unlabeled lane", () => {
  it("does not print On Mesita / From Google section headers", () => {
    const src = read("SearchResultsPanel.tsx");
    expect(src).not.toMatch(/On Mesita/);
    expect(src).not.toMatch(/From Google/);
    expect(src).not.toMatch(/ON GOOGLE/i);
    expect(src).toContain("membershipColor");
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
      shouldReloadNearbyCatalog(last, { lat: 25.505, lng: -100.3 }, blockBox, 0.5),
    ).toBe(true);
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.501, lng: -100.3 }, blockBox, 0.5),
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
      shouldReloadNearbyCatalog(last, { lat: 25.501, lng: -100.3 }, cityBox, 5, {
        fetchedAtMs: 1_000,
        nowMs: 10_000,
        minSec: 2,
      }),
    ).toBe(false);
  });
});

const RAIL_PLACE = {
  id: "p1",
  slug: "cosmo",
  name: "Cosmo San Pedro",
  category: "Nightclub",
  vibe: null,
  price_level: 4,
  currency: "MXN",
  listing_type: "web",
  status: "active",
  fiscal_type: "informal",
  plan: "free",
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
  email: null,
  created_at: "2026-08-01T00:00:00Z",
} as Place;

const railProps = {
  idle: true,
  catalogCount: 1,
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
      <SearchRailOverlay
        {...railProps}
        places={[]}
        catalogCount={0}
        catalogLoading
      />,
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

  it("empty nearby state has no Adjust control", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay {...railProps} places={[]} catalogCount={0} />,
    );
    expect(html).toContain("No places to show here yet");
    expect(html).not.toContain("Adjust");
    expect(html).not.toContain("filters");
  });

  it("offers Reset filters when predicates emptied the rail", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay
        {...railProps}
        places={[]}
        catalogCount={4}
        onResetFilters={() => {}}
      />,
    );
    expect(html).toContain("No places match these filters");
    expect(html).toContain("Reset filters");
    expect(html).not.toContain("Adjust");
  });
});

describe("Search catalog rail pages 80% wide with neighbor peeks and snaps", () => {
  it("uses 80/10/10 snap pages, not a 288px peek strip or a full-bleed card", () => {
    const overlay = read("search-catalog-overlays.tsx");
    const card = read("SearchRailCard.tsx");
    const client = read("SearchClient.tsx");
    const loading = read("../../../app/(shell)/discover/search/loading.tsx");
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
    const loading = read("../../../app/(shell)/discover/search/loading.tsx");
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
      <SearchRailOverlay
        {...railProps}
        places={[]}
        catalogCount={0}
        catalogLoading
      />,
    );
    expect(html).toContain("Finding nearby");
    expect(html).toContain("snap-center");
    expect(html).toContain("w-4/5");
    expect(html).not.toContain("w-[288px]");
  });
});

describe("Name search is Fast while typing and Deep after idle", () => {
  // Back on the map: Search IS the map and owns the only typed search on
  // Discover. Home carries no bar, so there is exactly one suggest caller.
  it("calls suggest-places twice: Autocomplete then Deep 3+3+3", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("FAST_DEBOUNCE_MS");
    expect(src).toContain("DEEP_IDLE_MS");
    expect(src).toContain('"fast"');
    expect(src).toContain('"deep"');
    expect(src).not.toContain("SUGGEST_DEBOUNCE_MS");
    expect(src).not.toContain("scope.country");
    expect(read("../../../lib/api/places.ts")).not.toMatch(
      /\.\.\.\(country \? \{ country \} : \{\}\)/,
    );
  });

  it("keeps Fast when Deep returns an empty list", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("Empty Deep keeps Fast");
    expect(src).toMatch(/if \(rows\.length > 0\) \{\s*deepSettled = true/);
    expect(src).toContain("Keep Fast results if Deep fails.");
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

describe("Search map reticle", () => {
  it("paints a screen-fixed plus and primary center dot, not a ring", () => {
    const src = read("SearchMap.tsx");
    expect(src).toContain("export function SearchMapReticle");
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("h-3.5 w-3.5");
    expect(src).toContain("bg-primary absolute top-1/2 left-1/2 h-1.5 w-1.5");
    expect(src).not.toContain("border-dotted");
    expect(src).not.toContain("h-24 w-24");
    expect(src).not.toContain("<Circle");
    expect(src).toContain("mapReady && <SearchMapReticle");
  });
});

describe("GooglePlaceSheet loads the first Places photo on open only", () => {
  it("uses Places (New) Details + one photo, never a map-wide prefetch", () => {
    const sheet = read("GooglePlaceSheet.tsx");
    expect(sheet).toContain("fetchGooglePlacePreview");
    expect(sheet).toMatch(/if \(!open \|\| !prediction \|\| !apiKey\) return/);
    expect(sheet).toContain("h-44");
    expect(sheet).toContain("referrerPolicy");
    expect(sheet).toContain("setHero");
    expect(sheet).toContain("mergeGooglePlacePreview");
    expect(sheet).toContain("settleGooglePlaceCache");
    expect(read("../../../lib/google-place-preview.ts")).toContain(
      "importLibrary",
    );
    expect(read("../../../lib/google-place-preview.ts")).toMatch(
      /fromRest = await previewFromRest[\s\S]*catch/,
    );
    expect(read("../../../lib/google-place-preview.ts")).toContain(
      "PlacesService",
    );
    expect(read("../../../lib/google-place-preview.ts")).toContain(
      "isDisplayablePlacePhoto",
    );
    expect(read("SearchClient.tsx")).not.toContain("places.googleapis.com");
    expect(read("SearchClient.tsx")).not.toContain("fetchGooglePlacePreview");
    expect(read("SearchRailCard.tsx")).not.toContain("places.googleapis.com");
  });
});

describe("every searchbar pick anchors the map (MESITA-1405)", () => {
  it("routes BOTH panel picks through one anchoring handler, never the modal", () => {
    const client = read("SearchClient.tsx");
    // One handler for both entities — the panel's Mesita/Google split no
    // longer picks a destination, only (later) a row mark.
    expect(client).toContain("onPickMesita={handleBarPick}");
    expect(client).toContain("onPickGoogle={handleBarPick}");
    // The early return that opened the modal the moment a row carried a
    // mesitaSlug/mesitaId is the line that went.
    expect(client).not.toMatch(
      /if \(prediction\.mesitaSlug \?\? prediction\.mesitaId\) \{\s*openMesitaProfileFromPrediction/,
    );
    // A pick is a camera move + a forced reload + card one.
    expect(client).toContain("const anchorMapTo = (");
    expect(client).toContain("anchorMapTo({ lat: anchorRow.lat, lng: anchorRow.lng }, anchorRow)");
    expect(client).toMatch(/anchorMapTo[\s\S]{0,400}forceNextLoad\.current = true/);
    expect(client).toContain("cameraAnchor={anchor?.camera ?? null}");
    // The modal and the Google sheet moved to the SECOND tap — the pin /
    // rail-card open paths — and stayed off the bar pick.
    expect(client).toContain("openGooglePreview");
    expect(client).toContain("openMesitaProfileFromPrediction");
    const barPick = client.slice(
      client.indexOf("const handleBarPick"),
      client.indexOf("const handleOpenPlace"),
    );
    expect(barPick).not.toContain("openGooglePreview");
    expect(barPick).not.toContain("setPreviewOpen");
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
    // close); a venue anchor pans.
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
    // closest venue after every reload — fatal right after a Location
    // anchor fits a whole city.
    expect(client).toContain("panTargetId={selectedId}");
    expect(map).toMatch(/<PanTo lat=\{panLat\} lng=\{panLng\}/);
    expect(map).not.toContain("<PanTo lat={selectedLat}");
    // A Location pick clears the lingering explicit selection too.
    expect(client).toMatch(/\} else \{[\s\S]{0,220}setSelectedId\(null\);/);
  });

  it("prepends the pick after the filters and the cap — they never veto it", () => {
    const client = read("SearchClient.tsx");
    const memo = client.slice(
      client.indexOf("const catalog = useMemo"),
      client.indexOf("const filtersCutCatalog"),
    );
    expect(memo).toContain("applyMapFilters");
    expect(memo).toContain("takeMapResultLimit");
    // Prepend runs LAST, so a partners-only filter cannot hide the
    // Google-only place the guest explicitly typed.
    expect(memo.indexOf("takeMapResultLimit")).toBeLessThan(
      memo.indexOf("prependAnchorPlace"),
    );
  });
});

describe("a Location wears the location icon, never a membership colour (MESITA-1404)", () => {
  const rows: PlacePrediction[] = [
    {
      placeId: "loc-1",
      mainText: "Ciudad de México",
      secondaryText: "CDMX, Mexico",
      status: "not_in_mesita",
      kind: "location",
      locationType: "locality",
    },
    {
      placeId: "ven-1",
      mainText: "Taquería Nueva",
      secondaryText: "Calle Falsa 123",
      status: "not_in_mesita",
    },
  ];

  it("marks the Location row with the icon and keeps the venue dot untouched", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPanel
        query="ciudad"
        searching={false}
        searchError={null}
        predictions={rows}
        addStates={{}}
        onPickMesita={() => {}}
        onPickGoogle={() => {}}
      />,
    );
    expect(html).toContain("lucide-map-pin");
    // The spoken half of the mark names the ENTITY, not a missing profile.
    expect(html).toContain("Ciudad de México, CDMX, Mexico, City");
    // The venue row keeps its gray dot and its venue answer.
    expect(html).toContain("No profile yet");
    // Exactly ONE membership dot renders — the city carries none, so the
    // two semantics never share a mark (no fourth colour, no shared gray).
    expect(html.match(/background-color:#9ca3af/g)?.length).toBe(1);
    expect(html).not.toContain("#ffc400");
    // No source labels, no badge, no section header — the icon says it.
    expect(html).not.toContain(">City<");
    expect(html).not.toContain(">Location<");
    expect(html).not.toContain("From Google");
  });

  it("branches on kind BEFORE the tone function is asked anything", () => {
    const panel = read("SearchResultsPanel.tsx");
    const branchAt = panel.indexOf('prediction.kind === "location"');
    expect(branchAt).toBeGreaterThan(-1);
    expect(branchAt).toBeLessThan(panel.indexOf("membershipTone(prediction)"));
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
    status: "not_in_mesita",
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

  it("anchorPlaceFromPrediction keeps Mesita identity for stamped rows", () => {
    const row = anchorPlaceFromPrediction({
      ...GOOGLE_PICK,
      status: "web_listed",
      mesitaId: "m-1",
      mesitaSlug: "taqueria-nueva",
      partner: true,
      enriched: true,
    })!;
    expect(row.id).toBe("m-1");
    expect(row.slug).toBe("taqueria-nueva");
    expect(row.partner).toBe(true);
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
    const richer = { ...RAIL_PLACE, id: "b", photos: ["https://x/p.jpg"] } as Place;
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
