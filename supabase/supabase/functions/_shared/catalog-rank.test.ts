import { assertEquals } from "jsr:@std/assert@1";
import {
  catalogAdmitted,
  catalogScore,
  rankFamilyLists,
  type CatalogListPlace,
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
    row("both", ["restaurants", "bars_nightlife"]),
    row("cafe", ["cafes_bakeries"]),
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
  assertEquals(lists.map((l) => l.key), [
    "restaurants",
    "cafes_bakeries",
    "bars_nightlife",
  ]);
  assertEquals(lists[0].places.map((p) => p.id), ["both"]);
  assertEquals(lists[2].places.map((p) => p.id), ["both"]);
  assertEquals(lists.every((l) => l.source === "family"), true);
});

Deno.test("enriched and ready are required", () => {
  assertEquals(catalogAdmitted({ enriched_at: null, content_state: "ready" }), false);
  assertEquals(
    catalogAdmitted({ enriched_at: "2026-01-01T00:00:00Z", content_state: "generating" }),
    false,
  );
  const lists = rankFamilyLists(
    [row("raw", ["restaurants"], { enriched_at: null })],
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
  const rows = [row("far", ["restaurants"]), row("near", ["restaurants"])];
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
  const rows = [row("quiet", ["experiences"]), row("loved", ["experiences"])];
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
