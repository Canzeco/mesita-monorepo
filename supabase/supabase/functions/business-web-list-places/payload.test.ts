// Source contract for the list payload. The EF itself calls Deno.serve on
// import, so these assert on the module text rather than invoking it — the
// same shape of guard web-admin uses for its catalog columns.
import { assert, assertEquals } from "jsr:@std/assert";

const SRC = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

Deno.test("photos are narrowed to ONE url, never the array", () => {
  // PostgREST cannot slice a text[] in select=, so the array arrives whole
  // and MUST be narrowed here. Shipping `photos` would put a 7-URL average
  // across up to 100 rows on the wire (MESITA-1553).
  assert(SRC.includes("photoUrl:"), "payload must carry photoUrl");
  assert(!/\bphotos:\s*p\.photos/.test(SRC), "payload must not ship the array");
});

Deno.test("state facts come from the shared helpers, never re-implemented", () => {
  for (
    const helper of [
      "isPlaceListed",
      "isPlaceRequested",
      "isPlaceEnriching",
      "isPlaceEnriched",
    ]
  ) {
    assert(SRC.includes(`${helper}(`), `${helper} must derive its fact`);
  }
});

Deno.test("the intake meter is the enrichment COLUMN, not an events join", () => {
  assert(SRC.includes("enrichment"), "must select place_profiles.enrichment");
  // pulseOf is the ONE shared reader (MESITA-1598) — business-web-list-places
  // and discovery-place.ts's ranking fold must parse the same column the
  // same way, never each with their own copy.
  assert(SRC.includes("pulseOf("), "must use the shared pulse reader");
  // Only the number is forwarded — the functions map stays server-side.
  assert(!SRC.includes("functions:"), "must not forward the functions map");
});

Deno.test("the holder's name rides the row, and the pool has none", () => {
  assert(SRC.includes("organizationName:"), "row must carry the holder name");
  assert(
    SRC.includes("r.organizations?.name ?? null"),
    "an unheld place reports null, never an invented holder",
  );
});

Deno.test("only columns that exist are selected", () => {
  // Guards the draft taxonomy's two inventions from reaching a select=.
  assert(!SRC.includes("visits_enabled"), "no such column");
  assert(!SRC.includes("adopted"), "no such column");
});

Deno.test("the row cap is unchanged", () => {
  const m = SRC.match(/MAX_LIMIT\s*=\s*(\d+)/);
  assert(m, "MAX_LIMIT must stay declared");
  assertEquals(m![1], "100");
});
