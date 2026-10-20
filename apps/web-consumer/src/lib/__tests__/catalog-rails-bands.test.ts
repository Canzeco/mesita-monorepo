import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CatalogRail, Place } from "@/lib/api/places";
import {
  SAVED_CHIP,
  PINNED_CHIPS,
  YOURS_CHIPS,
  GROUP_STRIPE,
  SOCIAL_CHIP,
  poolPlaces,
  PLACES_PAGE,
  savedPlaceList,
  NEAR_CHIP,
  POPULAR_CHIP,
  GOOGLE_RAIL_KEY,
  MESITA_RAIL_KEY,
  placesChips,
} from "@/components/consumer/home/CatalogRails";

// Pato (MESITA-2367, MESITA-2383): Places is one location bar over a split —
// a column of Favorites · Near · Popular · families beside ONE column of the chosen
// set. The server's rails are unchanged; a row picks which rail shows.
const src = readFileSync(
  join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
  "utf8",
);

const place = (id: string): Place => ({ id, name: id }) as Place;
const RAILS: CatalogRail[] = [
  { key: GOOGLE_RAIL_KEY, label: "Google Places", emoji: "📍", source: "signal", places: [place("g1")] },
  { key: MESITA_RAIL_KEY, label: "Mesita Selected", emoji: "✨", source: "signal", places: [place("m1")] },
  { key: "coffee", label: "Coffee", emoji: "☕", source: "family", places: [place("m1")] },
  { key: "breakfast", label: "Breakfast", emoji: "🥐", source: "family", places: [place("m2")] },
];

describe("the Places column (MESITA-2383)", () => {
  // Social, a rule, Favorites · Near · Popular pinned, a rule, then the
  // families (MESITA-2426), which
  // alone scroll (MESITA-2411).
  it("is Social, Saved, Nearby, Popular, then every guest family — no source rows (MESITA-2384, MESITA-2426)", () => {
    const labels = placesChips().map((c) => c.label);
    expect(labels.slice(0, 4)).toEqual(["Social", "Saved", "Nearby", "Popular"]);
    expect(labels).toContain("Coffee");
    expect(labels).toContain("Breakfast");
    expect(labels).not.toContain("Undefined");
    expect(placesChips().map((c) => c.key).slice(0, 4)).toEqual([SOCIAL_CHIP, SAVED_CHIP, NEAR_CHIP, POPULAR_CHIP]);
    expect(PINNED_CHIPS).toBe(4);
    // Three groups (MESITA-2484): Social · Saved │ Nearby · Popular │ the
    // families, each with its clay stripe; the rules are gone.
    expect(YOURS_CHIPS).toBe(2);
    expect(src).toContain("chips.slice(0, YOURS_CHIPS).map(categoryRow)");
    expect(src).toContain("chips.slice(YOURS_CHIPS, PINNED_CHIPS).map(categoryRow)");
    expect(src).not.toContain("data-places-rule");
    for (const g of ["yours", "around", "families"]) {
      expect(src).toContain(`data-places-group="${g}"`);
      expect(src).toContain(`GROUP_STRIPE.${g}`);
      expect(GROUP_STRIPE[g as keyof typeof GROUP_STRIPE]).toMatch(/^shadow-\[inset_3px_0_0_oklch\(/);
    }
    expect(src).toContain("chips.slice(PINNED_CHIPS).map(categoryRow)");
    expect(src).toContain('"scrollbar-hide mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain"');
    // Social's row reads like every row: no Soon tag, no muted label
    // (MESITA-2418); its pane still says Soon.
    expect(placesChips()[0]).toEqual({ key: SOCIAL_CHIP, label: "Social" });
    // Every row's mark is a line icon, never an emoji (MESITA-2478).
    expect(src).toContain("name={c.key}");
    expect(src).toContain("strokeWidth={chip === c.key ? 2.25 : 1.75}");
    expect(src).not.toMatch(/[\p{Emoji_Presentation}\uFE0F]/u);
    expect(src).not.toContain("c.soon");
    expect(src).not.toContain("data-places-soon");
    expect(placesChips().map((c) => c.key)).not.toContain(GOOGLE_RAIL_KEY);
    expect(placesChips().map((c) => c.key)).not.toContain(MESITA_RAIL_KEY);
  });

  it("Near and Popular are the server's pool in its order; a family filters it on area.familyKeys", () => {
    const area = (familyKeys: string[], final: number) => ({
      familyKeys,
      gates: { family: 1 as const, territory: null, radius: 1 as const, active: 1 as const, ready: null, reviews: 1 as const },
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
        { ...place("c"), family_keys: ["breakfast"], area: area(["coffee"], 0.7) },
      ],
    };
    expect(poolPlaces(pool, POPULAR_CHIP).map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(poolPlaces(pool, "coffee").map((p) => p.id)).toEqual(["a", "c"]);
    expect(poolPlaces(pool, "breakfast")).toEqual([]);
  });

  it("an Edge Function still on the legacy rails is drawn as before", () => {
    const legacy = { shape: "legacy" as const, rails: RAILS };
    expect(poolPlaces(legacy, NEAR_CHIP).map((p) => p.id)).toEqual(["m1", "g1"]);
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

  it("Saved lists saves newest first and skips a save with no preview", () => {
    const previews = new Map([
      ["a", place("a")],
      ["b", place("b")],
    ]);
    expect(savedPlaceList(new Set(["a", "gone", "b"]), previews).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("holds no location rows: the column is categories only", () => {
    const nav = src.slice(src.indexOf("const categories = ("), src.indexOf("const shell = ("));
    expect(nav).toContain('aria-label="Families"');
    expect(nav).not.toContain("savedLocations");
    expect(nav).not.toContain("data-places-add-location");
    expect(src).not.toContain("nearbyZones");
  });

  it("is a left column, a quarter wide (MESITA-2385), and opens on Near (MESITA-2426)", () => {
    expect(src).toContain("bg-muted flex w-1/4 shrink-0 flex-col");
    expect(src).toContain("useState<string>(NEAR_CHIP)");
    // The chosen row: white, bold, an ink bar on its left edge.
    expect(src).toContain('const ROW_ON = "bg-card text-foreground font-semibold";');
    expect(src).toContain("bg-foreground absolute inset-y-0 left-0 w-[3px]");
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
    expect(src).toContain("const from = origin ?? coords ?? (onCityFallback ? MONTERREY_CENTER : null);");
    expect(src).toContain("apiListAreaPool(supabase, from, prefer, families)");
  });

  // MESITA-2476 (Pato: "location must be inside a box or something"): a
  // rounded box, quiet grey on the white header since MESITA-2480, beside
  // the name in one 52px row. Never the old full-width h-10 bar (MESITA-2405).
  it("the header's location is one box: pin, name, chevron, opening the sheet", () => {
    expect(picker).toContain("className={HOME_LOCATION_CLASS}");
    expect(picker).not.toContain("HEADER_PILL");
    const tokens = (picker.match(/HOME_LOCATION_CLASS =\s*"([^"]*)"/)?.[1] ?? "").split(/\s+/);
    for (const t of ["h-9", "rounded-xl", "border", "bg-muted", "text-foreground"])
      expect(tokens, t).toContain(t);
    // The side rail's grey (MESITA-2485): the box and the rail match.
    const rails = readFileSync(join(__dirname, "../../components/consumer/home/CatalogRails.tsx"), "utf8");
    expect(rails).toContain('className="bg-muted flex w-1/4 shrink-0 flex-col"');
    expect(tokens).not.toContain("bg-border");
    const tabs = readFileSync(join(__dirname, "../../components/consumer/ModeTabs.tsx"), "utf8");
    expect(tabs).toContain('className="flex h-[52px] items-center gap-3 px-4" data-home-header');
    // No drawn logo for now (MESITA-2480): the word, set in Outfit.
    expect(tabs).toContain('import { Outfit } from "next/font/google";');
    expect(tabs).toContain(">\n          Mesita\n        </span>");
    expect(tabs).not.toContain("MesitaLogo");
    expect(picker).not.toContain("border-border bg-card text-foreground hover:bg-muted relative flex h-10");
    expect(picker).toContain("<MapPin");
    expect(picker).toContain("<ChevronDown");
    expect(picker).toContain('aria-haspopup="dialog"');
    expect(picker).toContain("onClick={() => setPicking(true)}");
  });

  it("the sheet: the search field, then Current location and the saved locations (MESITA-2464)", () => {
    expect(picker.indexOf("data-places-location-search")).toBeLessThan(picker.indexOf("label: locationLabel(null"));
    expect(picker.indexOf("label: locationLabel(null")).toBeLessThan(picker.indexOf("savedLocations.map((l)"));
    expect(picker).toContain("bounds: l.bounds");
  });

  it("removing the active saved location falls back to Current location", () => {
    expect(picker).toContain("if (active?.key === `saved:${l.id}`) setActiveLocation(null);");
  });
});

describe("the Places grid (MESITA-2366)", () => {
  it("is the right three quarters, one square tile per row with 6px room around, scrolling on its own", () => {
    expect(src).toContain('const PLACES_LIST = "grid grid-cols-1 content-start gap-1.5 px-1.5 pt-1.5";');
    expect(src).toContain("w-3/4 flex-col overflow-y-auto");
    expect(src).not.toContain("writing-mode");
    expect(src).not.toContain("data-band");
  });

  // The bottom bar's white and its hairline (MESITA-2409). MESITA-2476 tried
  // the brand pink; Pato sent it back ("keep the white style", MESITA-2480).
  it("paints Home's header the bottom bar's white, with the bar's hairline under it", () => {
    const tabs = readFileSync(join(__dirname, "../../components/consumer/ModeTabs.tsx"), "utf8");
    expect(tabs).toContain('"border-border bg-card/95 sticky top-0 z-20 shrink-0 border-b backdrop-blur"');
    expect(tabs).not.toContain("brand-pink");
    expect(tabs).not.toContain("border-b-2");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
