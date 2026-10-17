import { assertEquals } from "jsr:@std/assert@1";
import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import {
  catalogAdmitted,
  type CatalogListPlace,
  catalogScore,
  rankFamilyLists,
} from "./catalog-rank.ts";
import {
  DEFAULT_CATALOG_RANKING,
  DEFAULT_SIGNAL_PARAMS,
} from "./discovery-config.ts";
import type { SignalPlace } from "./discovery-signals.ts";

const guest = { lat: 19.4326, lng: -99.1332 };

function row(
  id: string,
  families: string[],
  over: Partial<CatalogListPlace> = {},
): CatalogListPlace {
  return {
    id,
    family_keys: families,
    enriched_at: "2026-01-01T00:00:00Z",
    content_state: "ready",
    ...over,
  };
}

function place(over: Partial<SignalPlace> = {}): SignalPlace {
  return {
    lat: guest.lat,
    lng: guest.lng,
    hours: null,
    category: null,
    embedding: null,
    rating: 4.2,
    user_ratings_total: 60,
    ...over,
  };
}

Deno.test("undefined is not a list and a dual-family place is in both", () => {
  const rows = [
    row("only-undefined", ["undefined"]),
    row("both", ["dinner", "drinks"]),
    row("cafe", ["coffee"]),
  ];
  const places = rows.map(() => place());
  const lists = rankFamilyLists(
    rows,
    places,
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    guest,
    8,
  );
  assertEquals(lists.map((l) => l.key), ["all", ...CATALOG_FAMILY_SLUGS]);
  assertEquals(lists[0].label, "All");
  assertEquals(lists[0].places.map((p) => p.id), [
    "only-undefined",
    "both",
    "cafe",
  ]);
  const placesOf = (key: string) =>
    lists.find((list) => list.key === key)!.places.map((p) => p.id);
  assertEquals(placesOf("coffee"), ["cafe"]);
  assertEquals(placesOf("dinner"), ["both"]);
  assertEquals(placesOf("drinks"), ["both"]);
  assertEquals(placesOf("breakfast"), []);
  assertEquals(placesOf("pizza"), []);
  assertEquals(lists.find((list) => list.key === "coffee")!.emoji, "☕");
  assertEquals(lists.every((l) => l.source === "family"), true);
});

Deno.test("enriched and ready are required", () => {
  assertEquals(
    catalogAdmitted({ enriched_at: null, content_state: "ready" }),
    false,
  );
  assertEquals(
    catalogAdmitted({
      enriched_at: "2026-01-01T00:00:00Z",
      content_state: "generating",
    }),
    false,
  );
  const lists = rankFamilyLists(
    [row("raw", ["dinner"], { enriched_at: null })],
    [place()],
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    guest,
    8,
  );
  assertEquals(lists, []);
});

Deno.test("name abstains without a query, so proximity still orders", () => {
  const far = place({ lat: guest.lat + 0.08 });
  const near = place();
  const rows = [row("far", ["dinner"]), row("near", ["dinner"])];
  const lists = rankFamilyLists(
    rows,
    [far, near],
    { ...DEFAULT_CATALOG_RANKING, name: 1, description: 1, selected: 1 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
    8,
  );
  assertEquals(lists[0].places.map((p) => p.id), ["near", "far"]);
});

Deno.test("weight 0 drops popularity and keeps incoming order", () => {
  const quiet = place({ rating: 3.2, user_ratings_total: 10 });
  const loved = place({ rating: 4.9, user_ratings_total: 900 });
  const rows = [row("quiet", ["go_out"]), row("loved", ["go_out"])];
  const ranking = {
    ...DEFAULT_CATALOG_RANKING,
    proximity: 0,
    popularity: 0,
    randomness: 0,
  };
  const lists = rankFamilyLists(
    rows,
    [quiet, loved],
    ranking,
    DEFAULT_SIGNAL_PARAMS,
    guest,
    8,
  );
  assertEquals(lists[0].places.map((p) => p.id), ["quiet", "loved"]);
  const ranked = rankFamilyLists(
    rows,
    [quiet, loved],
    { ...ranking, popularity: 1 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
    8,
  );
  assertEquals(ranked[0].places.map((p) => p.id), ["loved", "quiet"]);
});

Deno.test("proportional Catalog weights score the same", () => {
  const here = place({
    lat: guest.lat + 0.02,
    rating: 4.8,
    user_ratings_total: 400,
  });
  const base = {
    ...DEFAULT_CATALOG_RANKING,
    proximity: 1,
    popularity: 3,
    randomness: 0,
  };
  const doubled = { ...base, proximity: 2, popularity: 6 };
  assertEquals(
    catalogScore(here, base, DEFAULT_SIGNAL_PARAMS, guest),
    catalogScore(here, doubled, DEFAULT_SIGNAL_PARAMS, guest),
  );
});

Deno.test("a zero Catalog weight drops that signal", () => {
  const quiet = place({ rating: 3.1, user_ratings_total: 5 });
  const loved = place({ rating: 4.9, user_ratings_total: 800 });
  const off = {
    ...DEFAULT_CATALOG_RANKING,
    proximity: 0,
    popularity: 0,
    randomness: 0,
  };
  assertEquals(
    catalogScore(quiet, off, DEFAULT_SIGNAL_PARAMS, guest),
    catalogScore(loved, off, DEFAULT_SIGNAL_PARAMS, guest),
  );
  const on = { ...off, popularity: 2 };
  assertEquals(
    catalogScore(loved, on, DEFAULT_SIGNAL_PARAMS, guest) >
      catalogScore(quiet, on, DEFAULT_SIGNAL_PARAMS, guest),
    true,
  );
});

Deno.test("a zero name would tie; abstaining does not", () => {
  const a = place({ lat: guest.lat + 0.05 });
  const b = place();
  const withName = catalogScore(
    b,
    { ...DEFAULT_CATALOG_RANKING, proximity: 0, popularity: 0, name: 4 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  const without = catalogScore(
    a,
    { ...DEFAULT_CATALOG_RANKING, proximity: 0, popularity: 0, name: 0 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  assertEquals(withName, 1);
  assertEquals(without, 1);
});

Deno.test("catalog rows keep every enriched member when no cap is passed", () => {
  const rows = [
    row("a", ["coffee"]),
    row("b", ["coffee"]),
    row("c", ["coffee"]),
  ];
  const lists = rankFamilyLists(
    rows,
    [place(), place(), place()],
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  assertEquals(lists[0].places.map((p) => p.id).sort(), ["a", "b", "c"]);
});

Deno.test("Mesita Places keeps a created place that the enriched ring drops", () => {
  const created = row("created", ["coffee"], { enriched_at: null });
  const written = row("written", ["coffee"]);
  const rows = [created, written];
  const places = [place(), place()];
  const enriched = rankFamilyLists(
    rows,
    places,
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  assertEquals(enriched[0].places.map((p) => p.id), ["written"]);
  const mesita = rankFamilyLists(
    rows,
    places,
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    guest,
    undefined,
    false,
  );
  assertEquals(mesita[0].places.map((p) => p.id).sort(), [
    "created",
    "written",
  ]);
});
