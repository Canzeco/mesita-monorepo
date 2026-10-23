import { assertEquals } from "jsr:@std/assert@1";
import { CATALOG_FAMILY_SLUGS } from "./catalog-families.ts";
import {
  isSelectedRow,
  type CatalogListPlace,
  CATALOG_RAIL_CAP,
  buildCatalogRails,
} from "./catalog-rank.ts";

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
    // The operator's mark (MESITA-2707), not a fact of enrichment.
    selected: true,
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
  selected: false,
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

Deno.test("a Google stub or an unmarked Mesita row handed in as Selected is refused", () => {
  // Enriched and ready, yet not Selected: the mark is the operator's, never
  // derived from enrichment (MESITA-2707).
  const unmarked = row("unmarked", ["dinner"], { selected: false });
  const out = buildCatalogRails(
    [],
    [stub("x") as unknown as CatalogListPlace, unmarked, row("ok", ["dinner"])],
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

Deno.test("Selected is the operator's mark alone: never enrichment, never a ready profile (MESITA-2707)", () => {
  assertEquals(isSelectedRow({ selected: true }), true);
  assertEquals(isSelectedRow({ selected: false }), false);
  assertEquals(isSelectedRow({ selected: null }), false);
  assertEquals(isSelectedRow({}), false);
  // A Created place can be Selected before any Enrich run…
  assertEquals(
    isSelectedRow({ id: "created", selected: true, enriched_at: null, content_state: "ready" } as CatalogListPlace),
    true,
  );
  // …and an Enriched one is not Selected until the operator says so.
  assertEquals(
    isSelectedRow({
      id: "enriched",
      selected: false,
      enriched_at: "2026-01-01T00:00:00Z",
      content_state: "ready",
    } as CatalogListPlace),
    false,
  );
});

Deno.test("the operator's places per row caps every rail (MESITA-2319)", () => {
  const google = Array.from({ length: 8 }, (_, i) => stub(`g${i}`));
  const selected = Array.from({ length: 8 }, (_, i) => row(`s${i}`, ["coffee"]));
  for (const rail of buildCatalogRails(google, selected, 3)) {
    assertEquals(rail.places.length, 3);
  }
});
