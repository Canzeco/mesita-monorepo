import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  HOME_TABS,
  poolPlaces,
  PLACES_PAGE,
  savedPlaceList,
  ALL_CHIP,
  GOOGLE_RAIL_KEY,
  MESITA_RAIL_KEY,
  placesChips,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2517): under Home's header, two tabs — Places (a chip row
// over full-width tiles) and Social (the feed). It was a category column
// beside the tiles (MESITA-2367 to MESITA-2516).
const src = readFileSync(
  join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
  "utf8",
);

const place = (id: string): Place => ({ id, name: id }) as Place;
const RAILS: CatalogRail[] = [
  {
    key: GOOGLE_RAIL_KEY,
    label: "Google Places",
    emoji: "📍",
    source: "signal",
    places: [place("g1")],
  },
  {
    key: MESITA_RAIL_KEY,
    label: "Mesita Selected",
    emoji: "✨",
    source: "signal",
    places: [place("m1")],
  },
  {
    key: "coffee",
    label: "Coffee",
    emoji: "☕",
    source: "family",
    places: [place("m1")],
  },
  {
    key: "breakfast",
    label: "Breakfast",
    emoji: "🥐",
    source: "family",
    places: [place("m2")],
  },
];

describe("Home's tabs and the Places chips (MESITA-2517)", () => {
  // Pato: "header (Mesita location as it is) then another header (Places.
  // Social) … If places, show the horizontal catalog, is social, show the
  // social feed".
  it("is two tabs, Places then Social, Places first", () => {
    expect(HOME_TABS.map((t) => t.label)).toEqual(["Places", "Social"]);
    expect(src).toContain('const [tab, setTab] = useState<HomeTab>("places");');
    expect(src).toContain('role="tablist"');
    expect(src).toContain("data-home-tabs");
    // The chosen tab: bold over a black bar the tab's full width on the
    // strip's bottom edge (MESITA-2539, as MESITA-2527 drew it; the word
    // underline of MESITA-2530/2533 is gone).
    expect(src).toContain(
      'on ? "text-foreground font-semibold" : "text-muted-foreground"',
    );
    expect(src).toContain('"relative flex-1 py-3 text-sm transition"');
    expect(src).toContain("bg-foreground absolute inset-x-0 bottom-0 h-0.5");
    expect(src).not.toContain("-inset-x-4");
    expect(src).not.toContain('<span className="relative inline-block pb-1">');
    expect(src).toContain(
      "return shell(<SocialFeed samplePlaces={samplePlaces} />);",
    );
  });

  // MESITA-2519 (Pato: "keep the later view of the failies. its fastwer to
  // browse … LEFT MENU OF FAMILIES"): the horizontal chips went back to the
  // left column, under the tabs.
  it("Places is the left family column — Top, then every family, one scrolling list — beside the tiles", () => {
    const labels = placesChips().map((c) => c.label);
    // Favorites left the column for the Saved tab (Pato, MESITA-2522:
    // "remove favorites from this lateral menu").
    // The word is Top, the key stays all (MESITA-2534).
    expect(labels[0]).toBe("Top");
    expect(placesChips()[0].key).toBe(ALL_CHIP);
    for (const gone of [
      "Favorites",
      "Saved",
      "Social",
      "Nearby",
      "Popular",
      "Undefined",
    ]) {
      expect(labels, gone).not.toContain(gone);
    }
    expect(labels).toContain("Coffee");
    expect(labels).toContain("Breakfast");
    expect(placesChips().map((c) => c.key)).not.toContain(GOOGLE_RAIL_KEY);
    expect(placesChips().map((c) => c.key)).not.toContain(MESITA_RAIL_KEY);
    // A quarter-wide column beside the tiles, on the Places tab only.
    // The column is the darker hairline grey (MESITA-2537: "the lateral bark
    // darker"); the chosen row stays white.
    expect(src).toContain('className="bg-border flex w-1/4 shrink-0 flex-col"');
    expect(src).toContain('{tab === "places" ? categories : null}');
    // ONE scrolling list, Top first, no pinned head (MESITA-2534: "don't
    // divide al from the other families"); no colour stripes (MESITA-2521).
    expect(src).toContain("{chips.map(categoryRow)}");
    expect(src).toContain('data-places-group="families"');
    expect(src).not.toContain('data-places-group="pinned"');
    expect(src).not.toContain("PINNED_CHIPS");
    expect(src).not.toContain("GROUP_STRIPE");
    expect(src).not.toContain("oklch(");
    // The chosen row: white, bold, an ink bar on its left edge.
    expect(src).toContain(
      'const ROW_ON = "bg-card text-foreground font-semibold";',
    );
    expect(src).toContain("bg-foreground absolute inset-y-0 left-0 w-[3px]");
    // The horizontal chip row is gone again.
    for (const gone of [
      "chipRow",
      "CHIP_ON",
      "overflow-x-auto",
      "SOCIAL_CHIP",
    ]) {
      expect(src, gone).not.toContain(gone);
    }
    // Every row's mark is a line icon, never an emoji (MESITA-2478).
    expect(src).toContain("name={c.key}");
    expect(src).toContain("strokeWidth={on ? 2.25 : 1.75}");
    expect(src).not.toMatch(/[\p{Emoji_Presentation}\uFE0F]/u);
  });

  it("Near and Popular are the server's pool in its order; a family filters it on area.familyKeys", () => {
    const area = (familyKeys: string[], final: number) => ({
      familyKeys,
      gates: {
        family: 1 as const,
        territory: null,
        radius: 1 as const,
        active: 1 as const,
        ready: null,
        reviews: 1 as const,
      },
      signals: { proximity: 1, popularity: 0.5 },
      selected: 1,
      source: "selected" as const,
      base: final,
      final,
      formula: "point" as const,
    });
    const pool = {
      shape: "unified" as const,
      kind: "point" as const,
      places: [
        { ...place("a"), area: area(["coffee"], 0.9) },
        { ...place("b"), area: area(["dinner"], 0.8) },
        // The card says breakfast; the gate read coffee — the server wins.
        {
          ...place("c"),
          family_keys: ["breakfast"],
          area: area(["coffee"], 0.7),
        },
      ],
    };
    expect(poolPlaces(pool, ALL_CHIP).map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(poolPlaces(pool, "coffee").map((p) => p.id)).toEqual(["a", "c"]);
    expect(poolPlaces(pool, "breakfast")).toEqual([]);
  });

  it("an Edge Function still on the legacy rails is drawn as before", () => {
    const legacy = { shape: "legacy" as const, rails: RAILS };
    expect(poolPlaces(legacy, ALL_CHIP).map((p) => p.id)).toEqual(["m1", "g1"]);
    expect(poolPlaces(legacy, "coffee").map((p) => p.id)).toEqual(["m1"]);
    expect(src).toContain("catalog_shape_legacy");
  });

  it("pages after ranking: 20 at a time, a sentinel asks for more, no request", () => {
    expect(PLACES_PAGE).toBe(20);
    expect(src).toContain("list.slice(0, pageCount * PLACES_PAGE)");
    expect(src).toContain("data-places-more");
    expect(src).toContain("new IntersectionObserver(");
    // A kept pool paints without a request.
    expect(src).toContain("const kept = readAreaPool(requestKey);");
    expect(src).toContain('if (!kept) void fetchPool("fresh");');
  });

  it("a family with nothing here says so", () => {
    expect(src).toContain("title={`Nothing in ${label} here yet`}");
  });

  it("each tile carries the temporary breakdown, and its events carry source, rank and final", () => {
    expect(src).toContain("<AreaDiagnostics area={place.area} />");
    expect(src).toContain('trackEvent(supabase, "home_card_open"');
    expect(src).toContain("...tileFacts(place, rank)");
  });

  it("Favorites lists hearts newest first and skips one with no preview", () => {
    const previews = new Map([
      ["a", place("a")],
      ["b", place("b")],
    ]);
    expect(
      savedPlaceList(new Set(["a", "gone", "b"]), previews).map((p) => p.id),
    ).toEqual(["b", "a"]);
  });

  it("holds no location rows and opens on All", () => {
    expect(src).not.toContain("savedLocations");
    expect(src).not.toContain("data-places-add-location");
    expect(src).not.toContain("nearbyZones");
    expect(src).toContain("useState<string>(ALL_CHIP)");
  });
});

describe("the location lives in Home's header (MESITA-2401)", () => {
  const picker = readFileSync(
    join(__dirname, "../../components/consumer/home/LocationPicker.tsx"),
    "utf8",
  );

  it("Places draws no location bar or sheet; it reads the shared active location", () => {
    expect(src).not.toContain("data-places-location-bar");
    expect(src).not.toContain("<LocalSheet");
    expect(src).toContain("const origin = useActiveLocation();");
    // A saved location, else the fix, else the city's centre (MESITA-2472).
    expect(src).toContain(
      "const from = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);",
    );
    expect(src).toContain("apiListAreaPool(supabase, from, families)");
  });

  // MESITA-2476 (Pato: "location must be inside a box or something"): a
  // rounded box, quiet grey on the white header since MESITA-2480, beside
  // the name in one 52px row. Never the old full-width h-10 bar (MESITA-2405).
  it("the header's location is one box: pin, name, chevron, opening the sheet", () => {
    expect(picker).toContain("className={HOME_LOCATION_CLASS}");
    expect(picker).not.toContain("HEADER_PILL");
    const tokens = (
      picker.match(/HOME_LOCATION_CLASS =\s*"([^"]*)"/)?.[1] ?? ""
    ).split(/\s+/);
    for (const t of [
      "h-9",
      "rounded-xl",
      "border",
      // The quiet grey on the white header (MESITA-2480, MESITA-2531).
      "bg-muted",
      "text-foreground",
    ])
      expect(tokens, t).toContain(t);
    expect(tokens).not.toContain("bg-background/15");
    expect(tokens).not.toContain("bg-card");
    const tabs = readFileSync(
      join(__dirname, "../../components/consumer/ModeTabs.tsx"),
      "utf8",
    );
    expect(tabs).toContain(
      'className="flex h-[52px] items-center gap-3 px-4" data-home-header',
    );
    // No drawn logo for now (MESITA-2480): the word, set in Outfit.
    expect(tabs).toContain('import { Outfit } from "next/font/google";');
    expect(tabs).toMatch(/data-home-wordmark\s*>\s*Mesita\s*<\/span>/);
    expect(tabs).not.toContain("MesitaLogo");
    expect(picker).not.toContain(
      "border-border bg-card text-foreground hover:bg-muted relative flex h-10",
    );
    expect(picker).toContain("<MapPin");
    expect(picker).toContain("<ChevronDown");
    expect(picker).toContain('aria-haspopup="dialog"');
    expect(picker).toContain("onClick={() => setPicking(true)}");
  });

  it("the sheet: the search field, then Current location and the saved locations (MESITA-2464)", () => {
    expect(picker.indexOf("data-places-location-search")).toBeLessThan(
      picker.indexOf("label: locationLabel(null"),
    );
    expect(picker.indexOf("label: locationLabel(null")).toBeLessThan(
      picker.indexOf("savedLocations.map((l)"),
    );
    // A saved location is a pin (MESITA-2501): the sheet never passes a
    // rectangle on.
    expect(picker).not.toContain("bounds: l.bounds");
  });

  it("removing the active saved location falls back to Current location", () => {
    // Remove lives in the pin picker's edit screen since MESITA-2501.
    const pin = readFileSync(
      join(__dirname, "../../components/consumer/home/PinPicker.tsx"),
      "utf8",
    );
    expect(pin).toContain(
      "if (activeKey === savedLocationKey(entry.id)) setActiveLocation(null);",
    );
  });
});

describe("the Places grid (MESITA-2366)", () => {
  it("is full width, one square tile per row with 6px room around, scrolling on its own", () => {
    expect(src).toContain(
      'const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";',
    );
    expect(src).toContain(
      "bg-card scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain",
    );
    expect(src).not.toContain("writing-mode");
    expect(src).not.toContain("data-band");
  });

  // White, and the tab strip white too (Pato, MESITA-2537: "making the header
  // white and the second header also light"; MESITA-2531: "the mesita
  // header white and the place and social a bit darker"). MESITA-2529's stone
  // header was sent back; ink over white tabs (MESITA-2524) too; MESITA-2476's
  // pink was sent back.
  it("paints Home's header and tab strip white, the name in ink", () => {
    const tabs = readFileSync(
      join(__dirname, "../../components/consumer/ModeTabs.tsx"),
      "utf8",
    );
    expect(tabs).toContain(
      // A 1px hairline under it (MESITA-2538), never a 2px rule.
      '"border-border bg-card text-foreground sticky top-0 z-20 shrink-0 border-b"',
    );
    expect(tabs).toContain('"text-foreground shrink-0 text-2xl');
    expect(tabs).not.toContain("bg-foreground text-background");
    // The strip: white like the header, one light top block (MESITA-2537).
    expect(src).toContain('className="border-border bg-card flex shrink-0 border-b"');
    expect(src).not.toContain("color-mix(");
    expect(tabs).not.toContain("brand-pink");
    expect(tabs).not.toContain("border-b-2");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
