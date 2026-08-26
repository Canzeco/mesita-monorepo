import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmptySearchPrompt, SearchRailOverlay } from "@/components/consumer/search/search-catalog-overlays";
import { SearchBar } from "@/components/consumer/search/SearchBar";
import { viewportCenter } from "@/components/consumer/search/search-utils";
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

  it("shows the country code and a compass for location on Search", () => {
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
    expect(html).toContain("MX");
    expect(html).toContain("location set");
    expect(html).toContain("lucide-compass");
    expect(html).not.toContain("Filters");
    expect(html).not.toContain("SlidersHorizontal");
  });

  it("renders an em dash when country is unset", () => {
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
    expect(html).toContain("any country");
    expect(html).toContain("location not set");
  });
});

describe("Search map catalog reloads nearby as the camera moves", () => {
  it("loads the closest 50 from Nearby Search, not an SSR 200 dump", () => {
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
  });
});

describe("Search pick and map center respect filters", () => {
  it("keeps an explicit On Mesita pick on the map when filters cut it", () => {
    const src = read("SearchClient.tsx");
    expect(src).toMatch(/filtered\.some\(\(p\) => p\.id === selectedId\)/);
    expect(src).toContain("picked ? [picked, ...filtered]");
  });

  it("recenters the map on the location param, not only the device", () => {
    expect(read("SearchClient.tsx")).toMatch(/viewCenter=\{center\}/);
    expect(read("SearchClient.tsx")).toMatch(/locationOptOut/);
    expect(read("SearchMap.tsx")).toContain("viewCenter");
    expect(read("SearchMap.tsx")).toMatch(/Recentre target=\{lookAt\}/);
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
  filtersActive: false,
  railCollapsed: false,
  railIndex: 0,
  selectedId: null as string | null,
  railScrollRef: { current: null },
  onShowRail: () => {},
  onHideRail: () => {},
  onRailScroll: () => {},
  onSelectPlace: () => {},
  onOpenPlace: () => {},
  onOpenFilters: () => {},
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
      <SearchRailOverlay
        {...railProps}
        places={[RAIL_PLACE]}
        catalogLoading
      />,
    );
    expect(html).toContain("Updating nearby");
    expect(html).toContain("Cosmo San Pedro");
    expect(html).toContain("opacity-55");
  });
});
