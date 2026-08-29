import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RailCard } from "@/components/consumer/search/SearchRailCard";
import { SearchCategoryRow } from "@/components/consumer/search/SearchCategoryRow";
import { SearchFilterRow } from "@/components/consumer/search/SearchFilterRow";
import {
  EmptySearchPrompt,
  SearchRailOverlay,
} from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { SearchMapFilters } from "@/components/consumer/search/SearchMapFilters";
import { SearchScopeSheet } from "@/components/consumer/search/SearchScopeSheet";
import {
  catalogIsStale,
  clampReloadMinKm,
  clampReloadMinSec,
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

describe("SearchCategoryRow", () => {
  it("renders the six Category families, not Types or Discovery knobs", () => {
    const rest = renderToStaticMarkup(<SearchCategoryRow familyKeys={[]} />);
    expect(rest).toContain("Category");
    expect(rest).toContain("Restaurants");
    expect(rest).toContain("Bars");
    expect(rest).toContain("Cafés");
    expect(rest).toContain("Wellness");
    expect(rest).toContain("Experiences");
    expect(rest).toContain("Culture");
    expect(rest).not.toContain("Nightclub");
    expect(rest).not.toContain("Types");
    expect(rest).not.toContain("Now");
    expect(rest).not.toContain("Visit");
    expect(rest).not.toContain("🍽️");
    expect(rest).not.toContain("bg-pink-gradient");

    const on = renderToStaticMarkup(
      <SearchCategoryRow familyKeys={["restaurants"]} />,
    );
    expect(on).toContain("bg-pink-gradient");
    expect(on).toContain('aria-pressed="true"');
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
  it("shows Places power and Super Category only — no status chips, types, distance, or time", () => {
    const html = renderToStaticMarkup(
      <SearchMapFilters onClose={() => {}} count={4} />,
    );
    expect(html).toContain("Places");
    expect(html).toContain("Mesita Partners &amp; Mesita Places &amp; Google Places");
    expect(html).toContain("Partners");
    expect(html).toContain("+ Places");
    expect(html).toContain("+ Google");
    expect(html).toContain("Super Category");
    expect(html).toContain("Restaurants");
    expect(html).toContain("Bars &amp; Nightlife");
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

describe("Search map catalog auto-reloads after distance and time", () => {
  it("loads the Map lane cap, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    expect(read("SearchClient.tsx")).toContain("CATALOG_NEARBY_MAX");
    expect(read("SearchClient.tsx")).toContain("onFirstViewport");
    expect(read("SearchClient.tsx")).toContain("shouldReloadNearbyCatalog");
    expect(read("SearchClient.tsx")).toContain("scheduleOrLoad");
    expect(read("SearchClient.tsx")).not.toContain("handleSearchHere");
    expect(read("SearchClient.tsx")).not.toContain("SearchHereButton");
    expect(read("SearchClient.tsx")).not.toContain("VIEWPORT_IDLE_MS");
    expect(read("SearchMap.tsx")).toContain("ViewportReporter");
    expect(read("SearchMap.tsx")).toContain("SearchMapReticle");
    expect(read("SearchMap.tsx")).toContain("noteProgrammaticCamera");
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

  it("reloads once when a later GPS fix lands off the fetched camera", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("firstFix");
    expect(src).toMatch(/catalogIsStale\(lastFetchedCenter\.current, next\)/);
    expect(src).toContain("forceNextLoad.current = true");
  });
});

describe("Search map puts the query pill and Filters button on one row", () => {
  it("cuts the nearby catalog with Places power + Category families on the chrome", () => {
    const src = read("SearchClient.tsx");
    expect(src).toContain("applyMapFilters");
    expect(src).toContain("useMapFilters");
    expect(src).toContain("SearchMapFilters");
    expect(src).toContain("SearchFilterRow");
    expect(src).toContain("SearchCategoryRow");
    expect(src).toContain("familyKeys={filters.familyKeys}");
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
    expect(read("SearchMapFilters.tsx")).toContain("Places");
    expect(read("SearchMapFilters.tsx")).toContain("SearchPowerBar");
    expect(read("SearchMapFilters.tsx")).toContain("Super Category");
    expect(read("SearchMapFilters.tsx")).not.toContain('label="Types"');
    expect(read("SearchMapFilters.tsx")).not.toContain('label="Category"');
    expect(read("SearchMapFilters.tsx")).not.toContain("MAP_STATUS_OPTIONS");
    expect(read("SearchMapFilters.tsx")).not.toContain("toggleMapStatus");
    expect(read("../../../lib/map-filters-engine.ts")).toContain(
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
    expect(read("SearchClient.tsx")).toContain('"fast"');
    expect(read("SearchClient.tsx")).toContain('"deep"');
    expect(read("SearchMapFilters.tsx")).not.toContain("Distance tolerance");
    expect(read("SearchMapFilters.tsx")).not.toContain("Anytime");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Adjust");
    expect(read("search-catalog-overlays.tsx")).toContain(
      "No places match these filters",
    );
    expect(read("../../../app/(shell)/search/loading.tsx")).toContain(
      "flex items-center gap-2",
    );
    expect(read("../../../app/(shell)/search/loading.tsx")).toContain(
      "flex gap-1.5 overflow-hidden",
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
    expect(read("../../../lib/map-defaults.ts")).toContain(
      "export function mapCircleIcon",
    );
    expect(read("SearchMap.tsx")).toContain("mapCircleIcon(pinFillColor");
    expect(read("SearchMap.tsx")).toContain("USER_ICON = mapCircleIcon");
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
    const loading = read("../../../app/(shell)/search/loading.tsx");
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
