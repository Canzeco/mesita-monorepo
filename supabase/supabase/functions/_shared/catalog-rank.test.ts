import { assertEquals } from "jsr:@std/assert@1";
import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import {
  catalogAdmitted,
  type CatalogListPlace,
  catalogScore,
  CATALOG_RAIL_CAP,
  buildCatalogRails,
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

const ids = (list: { places: Array<Record<string, unknown>> } | undefined) =>
  list?.places.map((p) => p.id);

const stub = (id: string) => ({
  id: `g:${id}`,
  googleOnly: true,
  enriched_at: null,
  content_state: "ready",
  family_keys: ["dinner"],
});

Deno.test("rails run Google Places, Mesita Selected, then families in catalog order", () => {
  const selected = CATALOG_FAMILY_SLUGS.map((slug) => row(slug, [slug]));
  const out = buildCatalogRails([stub("a")], selected);
  assertEquals(out.map((r) => r.key), [
    "google_places",
    "mesita_selected",
    ...CATALOG_FAMILY_SLUGS,
  ]);
  assertEquals(out[0].label, "Google Places");
  assertEquals(out[1].label, "Mesita Selected");
  assertEquals(out.slice(0, 2).every((r) => r.source === "signal"), true);
  assertEquals(out.slice(2).every((r) => r.source === "family"), true);
});

Deno.test("Google appears in rail 1 only", () => {
  const out = buildCatalogRails([stub("a"), stub("b")], [row("m", ["dinner"])]);
  for (const rail of out.slice(1)) {
    assertEquals(rail.places.some((p) => String(p.id).startsWith("g:")), false);
  }
  assertEquals(ids(out[0]), ["g:a", "g:b"]);
});

Deno.test("a Google stub or a Created row handed in as Selected is refused", () => {
  const created = row("created", ["dinner"], { enriched_at: null });
  const out = buildCatalogRails(
    [],
    [stub("x") as unknown as CatalogListPlace, created, row("ok", ["dinner"])],
  );
  assertEquals(ids(out.find((r) => r.key === "mesita_selected")), ["ok"]);
  assertEquals(ids(out.find((r) => r.key === "dinner")), ["ok"]);
});

Deno.test("a dual-family place is in both family rails; undefined is none", () => {
  const out = buildCatalogRails([], [
    row("both", ["dinner", "drinks"]),
    row("lost", ["undefined"]),
  ]);
  assertEquals(ids(out.find((r) => r.key === "dinner")), ["both"]);
  assertEquals(ids(out.find((r) => r.key === "drinks")), ["both"]);
  assertEquals(out.some((r) => r.key === "undefined"), false);
});

Deno.test("every rail caps at 5 and keeps the engine's order", () => {
  const google = Array.from({ length: 8 }, (_, i) => stub(`g${i}`));
  const selected = Array.from({ length: 8 }, (_, i) => row(`s${i}`, ["coffee"]));
  const out = buildCatalogRails(google, selected);
  for (const rail of out) assertEquals(rail.places.length, CATALOG_RAIL_CAP);
  assertEquals(ids(out.find((r) => r.key === "coffee")), [
    "s0",
    "s1",
    "s2",
    "s3",
    "s4",
  ]);
});

Deno.test("empty rails are omitted; nothing in leaves no rails", () => {
  assertEquals(buildCatalogRails([], []), []);
  assertEquals(
    buildCatalogRails([], [row("c", ["coffee"])]).map((r) => r.key),
    ["mesita_selected", "coffee"],
  );
  assertEquals(
    buildCatalogRails([stub("a")], []).map((r) => r.key),
    ["google_places"],
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

Deno.test("the operator's places per row caps every rail (MESITA-2319)", () => {
  const google = Array.from({ length: 8 }, (_, i) => stub(`g${i}`));
  const selected = Array.from({ length: 8 }, (_, i) => row(`s${i}`, ["coffee"]));
  for (const rail of buildCatalogRails(google, selected, 3)) {
    assertEquals(rail.places.length, 3);
  }
});
