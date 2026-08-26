import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  EmptySearchPrompt,
  SearchRailOverlay,
} from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { SearchScopeSheet } from "@/components/consumer/search/SearchScopeSheet";
import {
  clampReloadMinKm,
  nearbyReloadThresholdKm,
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

  it("shows the country flag and a compass for location on Search", () => {
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

describe("Search map catalog reloads nearby as the camera moves", () => {
  it("loads Mesita 20 ∪ Google Nearby 20, not an SSR 200 dump", () => {
    expect(read("SearchClient.tsx")).toContain("apiFetchNearbyCatalog");
    expect(read("SearchClient.tsx")).toContain("CATALOG_NEARBY_MAX");
    expect(read("SearchClient.tsx")).toContain("onFirstViewport");
    expect(read("SearchClient.tsx")).toContain("VIEWPORT_IDLE_MS");
    expect(read("SearchMap.tsx")).toContain("ViewportReporter");
    expect(read("search-catalog-overlays.tsx")).toContain(
      "Zoom in to see this area",
    );
    expect(read("search-catalog-overlays.tsx")).toContain("Finding nearby");
    expect(read("search-catalog-overlays.tsx")).toContain("Updating nearby");
    expect(read("SearchClient.tsx")).not.toContain("apiFetchPlacesInBbox");
    expect(read("SearchClient.tsx")).toContain("++viewportGen.current");
    expect(read("SearchClient.tsx")).toContain("shouldReloadNearbyCatalog");
    expect(read("SearchClient.tsx")).not.toContain("toFixed(3)");
    expect(read("../../../lib/api/places.ts")).toContain("google: true");
  });
});

describe("Search map has no discovery filters", () => {
  it("does not cut the nearby catalog with Swipe predicates", () => {
    const src = read("SearchClient.tsx");
    expect(src).not.toContain("applyDiscoveryFilters");
    expect(src).not.toContain("useDiscoveryFilters");
    expect(src).not.toContain("DiscoveryFilters");
    expect(src).not.toContain("onOpenFilters");
    expect(src).not.toContain("filtersActive");
    expect(read("search-catalog-overlays.tsx")).not.toContain("Adjust");
    expect(read("search-catalog-overlays.tsx")).not.toContain(
      "No places match these filters",
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
  it("paints selected pins black and keeps membership fills for the rest", () => {
    expect(read("SearchMap.tsx")).toContain("pinFillColor");
    expect(read("SearchClient.tsx")).toContain("overlayPinDecision");
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
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.501, lng: -100.3 },
        cityBox,
        5,
      ),
    ).toBe(false);
  });

  it("reloads after a neighborhood-scale pan", () => {
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.554, lng: -100.3 },
        cityBox,
        5,
      ),
    ).toBe(true);
  });

  it("uses 20% of visible width when zoomed out", () => {
    expect(nearbyReloadThresholdKm(100, 5)).toBe(20);
    expect(nearbyReloadThresholdKm(10, 5)).toBe(5);
    expect(clampReloadMinKm(99)).toBe(20);
    expect(clampReloadMinKm(undefined)).toBe(5);
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.554, lng: -100.3 },
        wideBox,
        5,
      ),
    ).toBe(false);
    expect(
      shouldReloadNearbyCatalog(
        last,
        { lat: 25.5, lng: -96 },
        wideBox,
        5,
      ),
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

  it("keeps the cards and says Updating nearby while a pan reloads", () => {
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
});

describe("Search catalog rail pages full-width and snaps", () => {
  it("uses ImageCarousel-style mandatory snap pages, not a 288px peek strip", () => {
    const overlay = read("search-catalog-overlays.tsx");
    const card = read("SearchRailCard.tsx");
    const client = read("SearchClient.tsx");
    const loading = read("../../../app/(shell)/search/loading.tsx");
    expect(overlay).toContain("snap-x snap-mandatory");
    expect(overlay).toContain("w-full shrink-0 snap-start");
    expect(overlay).not.toContain("w-[288px]");
    expect(overlay).not.toMatch(/flex gap-2 overflow-x-auto/);
    expect(card).toContain("flex w-full items-center");
    expect(card).not.toContain("w-[288px]");
    expect(client).toContain("el.scrollLeft / page");
    expect(client).toContain('inline: "start"');
    expect(client).not.toContain("RAIL_STRIDE");
    expect(client).not.toContain("w-[288px]");
    expect(loading).toContain("w-full shrink-0 snap-start");
    expect(loading).not.toContain("w-[288px]");
  });

  it("renders one full-width skeleton page, not peeking cards", () => {
    const html = renderToStaticMarkup(
      <SearchRailOverlay
        {...railProps}
        places={[]}
        catalogCount={0}
        catalogLoading
      />,
    );
    expect(html).toContain("Finding nearby");
    expect(html).toContain("snap-start");
    expect(html).not.toContain("w-[288px]");
  });
});

describe("GooglePlaceSheet loads the first Places photo on open only", () => {
  it("uses Places (New) Details + one photo, never a map-wide prefetch", () => {
    const sheet = read("GooglePlaceSheet.tsx");
    expect(sheet).toContain("fetchGooglePlacePreview");
    expect(sheet).toMatch(/if \(!open \|\| !prediction \|\| !apiKey\) return/);
    expect(sheet).toContain("h-44");
    expect(read("SearchClient.tsx")).not.toContain("places.googleapis.com");
    expect(read("SearchClient.tsx")).not.toContain("fetchGooglePlacePreview");
    expect(read("SearchRailCard.tsx")).not.toContain("places.googleapis.com");
  });
});
