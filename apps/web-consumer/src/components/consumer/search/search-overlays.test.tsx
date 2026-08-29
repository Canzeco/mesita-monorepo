import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RailCard } from "@/components/consumer/search/SearchRailCard";
import { SearchFilterRow } from "@/components/consumer/search/SearchFilterRow";
import {
  EmptySearchPrompt,
  SearchHereButton,
  SearchRailOverlay,
} from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { SearchMapFilters } from "@/components/consumer/search/SearchMapFilters";
import { SearchScopeSheet } from "@/components/consumer/search/SearchScopeSheet";
import {
  catalogIsStale,
  clampReloadMinKm,
  defaultRailSelection,
  nearbyReloadThresholdKm,
  railCenterIndex,
  shouldReloadNearbyCatalog,
  viewportCenter,
} from "@/components/consumer/search/search-utils";
import type { Place } from "@/lib/api/places";

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

  it("caps the overlay stack with max-h-[70%] so long lists scroll", () => {
    expect(read("SearchClient.tsx")).toMatch(/max-h-\[70%\]/);
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
  it("is icon-only, with a red count when filters are on", () => {
    const rest = renderToStaticMarkup(
      <SearchFilterRow count={0} onOpenFilters={() => {}} />,
    );
    expect(rest).toContain("lucide-sliders-horizontal");
    expect(rest).toContain("Filter places");
    expect(rest).not.toContain(">Filters<");
    expect(rest).not.toMatch(/>\s*Filters\s*</);
    expect(rest).not.toContain("bg-destructive");
    expect(rest).not.toContain("Restaurants");
    expect(rest).not.toContain("Bars");
    expect(rest).not.toContain("Now");
    expect(rest).not.toContain("Visit");
    expect(rest).not.toContain("🇲🇽");

    const on = renderToStaticMarkup(
      <SearchFilterRow count={3} onOpenFilters={() => {}} />,
    );
    expect(on).toContain("3 applied");
    expect(on).toContain("bg-destructive");
    expect(on).toContain(">3<");
    expect(on).not.toMatch(/>\s*Filters\s*</);
    expect(read("SearchFilterRow.tsx")).not.toContain("PLACE_FAMILIES");
    expect(read("SearchFilterRow.tsx")).not.toContain("onOpenScope");
  });
});

describe("SearchMapFilters", () => {
  it("shows Status and Category only — no distance or time", () => {
    const html = renderToStaticMarkup(
      <SearchMapFilters
        onClose={() => {}}
        categoryOptions={[{ slug: "night_club", label: "Nightclub" }]}
        count={4}
      />,
    );
    expect(html).toContain("Status");
    expect(html).toContain("Not on Mesita");
    expect(html).toContain("Created");
    expect(html).toContain("Enriched");
    expect(html).toContain("Partnered");
    expect(html).toContain("Promoted");
    expect(html).toContain("Category");
    expect(html).toContain("Restaurants");
    expect(html).toContain("Show 4 places");
    expect(html).not.toContain("Distance tolerance");
    expect(html).not.toContain("Anytime");
    expect(html).not.toContain("I want to");
    expect(html).not.toContain("Prioritize");
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

describe("Search map catalog reloads only when the guest asks", () => {
  it("loads the Map lane cap, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    expect(read("SearchClient.tsx")).toContain("CATALOG_NEARBY_MAX");
    expect(read("SearchClient.tsx")).toContain("onFirstViewport");
    expect(read("SearchClient.tsx")).toContain("handleSearchHere");
    expect(read("SearchClient.tsx")).toContain("SearchHereButton");
    expect(read("SearchClient.tsx")).not.toContain("VIEWPORT_IDLE_MS");
    expect(read("SearchMap.tsx")).toContain("ViewportReporter");
    expect(read("SearchMap.tsx")).toContain("SearchMapReticle");
    expect(read("search-catalog-overlays.tsx")).toContain(
      "Zoom in to see this area",
    );
    expect(read("search-catalog-overlays.tsx")).toContain("Finding nearby");
    expect(read("search-catalog-overlays.tsx")).toContain("Updating nearby");
    expect(read("search-catalog-overlays.tsx")).toContain("Search here");
    expect(read("SearchClient.tsx")).not.toContain("apiFetchPlacesInBbox");
    expect(read("SearchClient.tsx")).toContain("++viewportGen.current");
    expect(read("SearchClient.tsx")).not.toContain("shouldReloadNearbyCatalog");
    expect(read("SearchClient.tsx")).not.toContain("toFixed(3)");
    expect(read("../../../lib/api/places.ts")).toContain("google: true");
  });

  it("does not debounce a pan into a catalog fetch", () => {
    const src = read("SearchClient.tsx");
    expect(src).not.toMatch(/setTimeout\([\s\S]*loadViewport/);
    expect(src).toContain("markViewport(box)");
    expect(src).toContain("forceNextLoad");
  });

  it("reloads once when a later GPS fix lands off the fetched camera", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("firstFix");
    expect(src).toMatch(/catalogIsStale\(lastFetchedCenter\.current, next\)/);
    expect(src).toContain("forceNextLoad.current = true");
  });
});

describe("Search map puts the query pill and Filters button on one row", () => {
  it("cuts the nearby catalog with map Status + Category, never a chip strip", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("applyMapFilters");
    expect(src).toContain("useMapFilters");
    expect(src).toContain("SearchMapFilters");
    expect(src).toContain("SearchFilterRow");
    expect(src).toContain("mapFilterCount");
    expect(src).toContain("onOpenFilters={() => setFiltersOpen(true)}");
    expect(src).toContain("flex min-w-0 items-center gap-2");
    expect(src).toContain("min-w-0 flex-1");
    expect(src).not.toContain("applyDiscoveryFilters");
    expect(src).not.toContain("useDiscoveryFilters");
    expect(src).not.toContain("DiscoveryFilters");
    expect(src).not.toContain("flex-[1.15]");
    expect(src).not.toContain("SearchScopeSheet");
    expect(src).toMatch(/<SearchBar[\s\S]*?inputRef=\{searchInputRef\}\s*\/>/);
    expect(read("SearchBar.tsx")).not.toMatch(/Search passes `onOpenScope`/);
    expect(read("SearchMapFilters.tsx")).toContain("Status");
    expect(read("SearchMapFilters.tsx")).toContain("Category");
    expect(read("SearchMapFilters.tsx")).toContain("MAP_STATUS_OPTIONS");
    expect(read("../../../lib/map-filters-engine.ts")).toContain(
      '"Not on Mesita"',
    );
    expect(read("../../../lib/map-filters-engine.ts")).toContain('"Created"');
    expect(read("../../../lib/map-filters-engine.ts")).toContain('"Enriched"');
    expect(read("../../../lib/map-filters-engine.ts")).toContain('"Partnered"');
    expect(read("../../../lib/map-filters-engine.ts")).toContain('"Promoted"');
    expect(read("SearchMapFilters.tsx")).not.toContain("Distance tolerance");
    expect(read("SearchMapFilters.tsx")).not.toContain("Anytime");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Adjust");
    expect(read("search-catalog-overlays.tsx")).toContain(
      "No places match these filters",
    );
    expect(read("../../../app/(shell)/search/loading.tsx")).toContain(
      "flex items-center gap-2",
    );
    expect(read("../../../app/(shell)/search/loading.tsx")).not.toContain(
      "mt-2 flex gap-1.5",
    );
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
      /MAP_PLACE_PIN_RADIUS = 7/,
    );
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
    expect(clampReloadMinKm(undefined)).toBe(5);
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.554, lng: -100.3 }, wideBox, 5),
    ).toBe(false);
    expect(
      shouldReloadNearbyCatalog(last, { lat: 25.5, lng: -96 }, wideBox, 5),
    ).toBe(true);
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

  it("keeps the cards and says Updating nearby while Search here reloads", () => {
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
    const loading = read("../../../app/(shell)/search/loading.tsx");
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
    expect(client).toContain("idx === railIndex");
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
      "bg-muted relative aspect-square min-h-20 w-auto shrink-0 self-stretch overflow-hidden",
    );
    expect(card).toContain("overflow-hidden rounded-2xl border");
    expect(card).toContain('className="border-0 object-cover outline-none"');
    expect(card).not.toContain("rounded-xl");
    expect(card).not.toContain(" w-20 ");
    expect(card).not.toMatch(
      /aspect-square[^"]*\b(?:border|ring|rounded-xl)\b/,
    );
    expect(overlay).toContain(
      "aspect-square min-h-20 w-auto shrink-0 self-stretch rounded-none",
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
    expect(html).toContain("min-h-20");
    expect(html).not.toMatch(/aspect-square[^"]*\bborder\b/);
    expect(html).not.toMatch(/aspect-square[^"]*\brounded-xl\b/);
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
  it("calls suggest-places twice: Autocomplete then Deep 3+3+3", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("FAST_DEBOUNCE_MS");
    expect(src).toContain("DEEP_IDLE_MS");
    expect(src).toContain('"fast"');
    expect(src).toContain('"deep"');
    expect(src).not.toContain("SUGGEST_DEBOUNCE_MS");
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

describe("Search here and the map reticle", () => {
  it("renders a 44px Search here pill", () => {
    const html = renderToStaticMarkup(
      <SearchHereButton loading={false} stale onClick={() => {}} />,
    );
    expect(html).toContain("Search here");
    expect(html).toContain("min-h-11");
    expect(html).toContain("Search places around the map center");
    expect(html).toContain("lucide-rotate-cw");
    expect(html).toContain("--gradient-pink");
    expect(html).toContain("text-white");
    expect(html).toContain("ring-white/70");
  });

  it("swaps the label to Updating nearby while a reload runs", () => {
    const html = renderToStaticMarkup(
      <SearchHereButton loading stale={false} onClick={() => {}} />,
    );
    expect(html).toContain("Updating nearby");
    expect(html).toContain("aria-busy");
    expect(html).toContain("--gradient-pink");
    expect(html).not.toContain("ring-white/70");
  });

  it("paints a screen-fixed plus and approximate ring, not a geo circle", () => {
    const src = read("SearchMap.tsx");
    expect(src).toContain("export function SearchMapReticle");
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("h-24 w-24");
    expect(src).toContain("rounded-full border-2 border-dotted");
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
