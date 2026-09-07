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
});

// ── The functions map (MESITA-1608) ──────────────────────────────────────
//
// This block REPLACES an assertion that read:
//
//     assert(!SRC.includes("functions:"), "must not forward the functions map")
//
// That was the right law while the console row showed `Intake 3/10`. It is
// the wrong law for a states matrix with one column per intake function,
// because the high-water CANNOT answer per-function: `pulseHighWater` stops
// at the first gap by design, so a run that fixed function 7 after function 4
// failed reads as "7 never happened". The map is the only honest source.
//
// The guard is not deleted, it is INVERTED — and the wire key matters. The
// obvious spelling, `intakeFunctions:`, does not contain the lowercase
// substring `functions:`, so it would have sailed past the old assertion
// while reversing the decision that assertion existed to make visible.
// `enrich_functions` is the key business-web-get-overview already ships,
// through the same fold, so the two business payloads speak one language and
// any future substring guard sees it.

Deno.test("the functions map ships, folded, under the shared wire key", () => {
  assert(
    SRC.includes("enrich_functions:"),
    "the matrix needs per-function state, not just the high-water",
  );
  assert(
    SRC.includes("operatorFunctionStates("),
    "the map must go through the shared fold, never a local walk",
  );
  // The meter did not go away — the two facts ship side by side because they
  // answer different questions.
  assert(SRC.includes("intakePulse:"), "the high-water still ships");
});

Deno.test("the map is guarded at the call site, because the fold is not", () => {
  // foldFunctionStateMap walks Object.entries(map), which THROWS on null or
  // undefined. The column carries a not-null default, but the value arrives
  // typed `unknown` off PostgREST, so nothing in the type system stops a
  // malformed blob from reaching the fold.
  assert(
    SRC.includes("function enrichFunctionsOf("),
    "the map must be narrowed before folding",
  );
  assert(
    /typeof\s+map\s*===\s*"object"/.test(SRC),
    "the narrow must check the functions field itself, not just the wrapper",
  );
});

Deno.test("scope=all is a MEMBERSHIP read, and it withholds nothing", () => {
  // MESITA-1614: one console list, so Owned has to vary — which it cannot do
  // while each scope pre-filters the very column the matrix is showing.
  assert(SRC.includes('body.scope === "all"'), "scope=all must be parsed");
  assert(
    SRC.includes("const memberScope"),
    "org and all share one clearance predicate; two copies would drift",
  );
  // The gate is the CALLER's clearance, not whether a row is held. Keying it
  // off the row would blank half the matrix on the one screen built to
  // compare held places against claimable ones.
  assert(
    !/scope === "org" \? isPaidPlan/.test(SRC),
    "the fact gate must read memberScope, not scope === org",
  );
  assert(
    SRC.includes("requireOrgRole("),
    "a membership scope must prove membership",
  );
  // organizationId is what membership is checked AGAINST — no id, no read.
  assert(
    /organizationId is required for scope=\$\{scope\}/.test(SRC),
    "both membership scopes require an organizationId",
  );
});

Deno.test("scope=all is this org's places OR the unheld ones", () => {
  assert(
    SRC.includes("organization_id.eq.${organizationId},organization_id.is.null"),
    "all = held by this org, or held by nobody",
  );
  // `eq.null` is not a null test in PostgREST and would match nothing.
  assert(!SRC.includes("organization_id.eq.null"), "null needs is.null");
});

Deno.test("the direct-owner filter spares rows this org holds", () => {
  // placeIdsWithDirectOwner is the shared claim predicate: a place with a
  // project_members owner is not claimable even with organization_id null.
  // On scope=all it must not strip this organization's OWN rows, which are
  // held by definition and would otherwise vanish from its own list.
  assert(
    SRC.includes("r.organization_id !== null || !owned.has(r.id)"),
    "held rows survive the pool predicate",
  );
});

Deno.test("pool rows withhold the facts a guest has no claim to", () => {
  // getAuthedUser accepts ANY valid bearer token and the backend is a
  // singleton, so every consumer account can call scope=public. Ownership
  // proof, plan, and how far our pipeline got on a place nobody holds are
  // withheld there — as `undefined`, which renders "?", never a false "no".
  for (const fact of ["partner", "verified", "enrich_functions"]) {
    const m = SRC.match(new RegExp(`${fact}:[^,]*`));
    assert(m, `${fact} must be on the payload`);
    assert(
      m![0].includes("memberScope") || m![0].includes("verified ?"),
      `${fact} must be withheld on the pool`,
    );
  }
});

Deno.test("an empty catalog issues ZERO verification queries", () => {
  // rows is empty on every request today (0 places in production), so this
  // is the live path, not an edge case. chunked([]) yields no chunks, so the
  // loop never runs — the guard is structural, not a conditional someone can
  // forget to write.
  assert(SRC.includes("chunked("), "the batch must be chunked");
  assert(
    /for\s*\(const idPart of chunked\(/.test(SRC),
    "the query must live inside the chunk loop",
  );
  assert(
    !/\.in\("place_id", ids\)/.test(SRC),
    "never pass the whole id list straight to .in()",
  );
});

Deno.test("a failed verification read degrades to UNKNOWN, never to false", () => {
  // An empty Set would state "nobody here is verified" — a claim we did not
  // read. null says "we could not find out" and the console renders "?".
  assert(
    SRC.includes("verified = null;"),
    "a read error must clear the set, not leave it empty",
  );
  assert(
    SRC.includes("[list-places] project_verifications:"),
    "the swallowed failure must be logged, or it cannot be diagnosed later",
  );
});

Deno.test("Created and Partner come from the shared helpers too", () => {
  assert(SRC.includes("isPlaceSeeded("), "Created is the identity spine");
  assert(SRC.includes("isPaidPlan("), "Partner is plan !== free");
});

Deno.test("the search escapes LIKE wildcards", () => {
  // Raw interpolation leaves `_` and `%` live, so "cafe_" silently matches
  // "cafes" here and not in admin-web-search-places. Two search boxes, one
  // behaviour.
  assert(
    /replace\(\/\[%_\\\\\]\/g/.test(SRC),
    "escape %, _ and backslash before building the pattern",
  );
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
