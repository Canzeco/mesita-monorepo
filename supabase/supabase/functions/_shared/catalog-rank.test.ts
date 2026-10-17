import { assertEquals } from "jsr:@std/assert@1";
import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import {
  catalogAdmitted,
  type CatalogListPlace,
  catalogScore,
  CATALOG_RAIL_CAP,
  rankCatalogRails,
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

// 2026-10-17 15:00 UTC is Saturday morning on Mexico City's local clock.
const NOON_SAT = new Date("2026-10-17T15:00:00Z");
const at = { ...guest, now: NOON_SAT };
const ALWAYS = Object.fromEntries(
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    .map((d) => [d, [{ open: "00:00", close: "24:00" }]]),
);
const NEVER_SAT = { ...ALWAYS, saturday: [] };

function rails(rows: CatalogListPlace[], places: SignalPlace[], intent = at) {
  return rankCatalogRails(
    rows,
    places,
    DEFAULT_CATALOG_RANKING,
    DEFAULT_SIGNAL_PARAMS,
    intent,
  );
}

const ids = (list: { places: CatalogListPlace[] } | undefined) =>
  list?.places.map((p) => p.id);

Deno.test("rails run Right Now, Universal, then families in catalog order", () => {
  const rows = [
    row("cafe", ["coffee"]),
    row("both", ["dinner", "drinks"]),
    row("only-undefined", ["undefined"]),
  ];
  const out = rails(rows, rows.map(() => place({ hours: ALWAYS })));
  const families = CATALOG_FAMILY_SLUGS.filter((f) =>
    ["coffee", "dinner", "drinks"].includes(f)
  );
  assertEquals(out.map((r) => r.key), ["right_now", "universal", ...families]);
  assertEquals(out[0].label, "Right Now");
  assertEquals(out[0].emoji, "🕒");
  assertEquals(out[1].label, "Universal");
  assertEquals(out[1].emoji, "✨");
  assertEquals(out.slice(0, 2).every((r) => r.source === "signal"), true);
  assertEquals(out.slice(2).every((r) => r.source === "family"), true);
  assertEquals(out.find((r) => r.key === "coffee")!.emoji, "☕");
});

Deno.test("a dual-family place is in both family rails; undefined is none", () => {
  const rows = [row("both", ["dinner", "drinks"]), row("u", ["undefined"])];
  const out = rails(rows, rows.map(() => place()));
  assertEquals(ids(out.find((r) => r.key === "dinner")), ["both"]);
  assertEquals(ids(out.find((r) => r.key === "drinks")), ["both"]);
  assertEquals(out.some((r) => r.key === "undefined"), false);
  assertEquals(ids(out.find((r) => r.key === "universal"))!.sort(), [
    "both",
    "u",
  ]);
});

Deno.test("Right Now admits an open Created place and drops closed or no-hours", () => {
  const rows = [
    row("created-open", ["dinner"], { enriched_at: null }),
    row("closed", ["dinner"]),
    row("no-hours", ["dinner"]),
    row("busy", ["dinner"], { content_state: "generating" }),
  ];
  const out = rails(rows, [
    place({ hours: ALWAYS }),
    place({ hours: NEVER_SAT }),
    place({ hours: null }),
    place({ hours: ALWAYS }),
  ]);
  assertEquals(ids(out.find((r) => r.key === "right_now")), ["created-open"]);
  assertEquals(
    ids(out.find((r) => r.key === "universal"))!.includes("created-open"),
    false,
  );
});

Deno.test("Right Now sorts by proximity, then popularity", () => {
  const rows = [row("far", []), row("quiet", []), row("loved", [])];
  const out = rails(rows, [
    place({ hours: ALWAYS, lat: guest.lat + 0.08, rating: 5, user_ratings_total: 999 }),
    place({ hours: ALWAYS, rating: 3.2, user_ratings_total: 10 }),
    place({ hours: ALWAYS, rating: 4.9, user_ratings_total: 900 }),
  ]);
  assertEquals(ids(out[0]), ["loved", "quiet", "far"]);
});

Deno.test("Right Now is absent when nothing is open", () => {
  const rows = [row("a", ["coffee"]), row("b", ["coffee"])];
  const out = rails(rows, [place({ hours: NEVER_SAT }), place()]);
  assertEquals(out.map((r) => r.key), ["universal", "coffee"]);
});

Deno.test("every rail caps at 5; Universal and families are enriched-only", () => {
  const n = CATALOG_RAIL_CAP + 5;
  const rows = [
    ...Array.from({ length: n }, (_, i) => row(`e${i}`, ["coffee"])),
    row("created", ["coffee"], { enriched_at: null }),
  ];
  const out = rails(rows, rows.map(() => place({ hours: ALWAYS })));
  const universal = out.find((r) => r.key === "universal")!;
  assertEquals(CATALOG_RAIL_CAP, 5);
  assertEquals(universal.places.length, CATALOG_RAIL_CAP);
  assertEquals(ids(universal)!.includes("created"), false);
  const coffee = out.find((r) => r.key === "coffee")!;
  assertEquals(coffee.places.length, CATALOG_RAIL_CAP);
  assertEquals(ids(coffee)!.includes("created"), false);
  assertEquals(out[0].places.length, CATALOG_RAIL_CAP);
});

Deno.test("a short rail shows what it has", () => {
  const rows = [row("a", ["coffee"]), row("b", ["coffee"])];
  const out = rails(rows, rows.map(() => place({ hours: ALWAYS })));
  for (const r of out) assertEquals(r.places.length, 2);
});

Deno.test("families are enriched-only and an empty family is omitted", () => {
  const rows = [
    row("raw", ["dinner"], { enriched_at: null }),
    row("cafe", ["coffee"]),
  ];
  const out = rails(rows, [place(), place()]);
  assertEquals(out.map((r) => r.key), ["universal", "coffee"]);
});

Deno.test("no enriched place and nothing open leaves no rails", () => {
  assertEquals(
    rails([row("raw", ["dinner"], { enriched_at: null })], [place()]),
    [],
  );
});

Deno.test("the enriched ring requires enriched and ready", () => {
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
});

Deno.test("an enriched place leads at the default weights in Universal", () => {
  const rows = [row("far", ["dinner"]), row("near", ["dinner"])];
  const out = rails(rows, [place({ lat: guest.lat + 0.08 }), place()]);
  for (const key of ["universal", "dinner"]) {
    assertEquals(ids(out.find((r) => r.key === key)), ["near", "far"]);
  }
});

Deno.test("Enriched at weight 0 leaves Created and enriched to the other signals", () => {
  const created = place({ enriched: false, rating: 4.9, user_ratings_total: 900 });
  const written = place({ enriched: true, rating: 3.2, user_ratings_total: 10 });
  const ranking = { ...DEFAULT_CATALOG_RANKING, enriched: 0 };
  assertEquals(
    catalogScore(created, ranking, DEFAULT_SIGNAL_PARAMS, guest) >
      catalogScore(written, ranking, DEFAULT_SIGNAL_PARAMS, guest),
    true,
  );
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
    enriched: 2,
    popularity: 3,
    randomness: 0,
  };
  const doubled = { ...base, proximity: 2, enriched: 4, popularity: 6 };
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
    enriched: 0,
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
    { ...DEFAULT_CATALOG_RANKING, proximity: 0, enriched: 0, popularity: 0, name: 4 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  const without = catalogScore(
    a,
    { ...DEFAULT_CATALOG_RANKING, proximity: 0, enriched: 0, popularity: 0, name: 0 },
    DEFAULT_SIGNAL_PARAMS,
    guest,
  );
  assertEquals(withName, 1);
  assertEquals(without, 1);
});
