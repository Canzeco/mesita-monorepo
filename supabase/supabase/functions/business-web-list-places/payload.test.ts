// Source contract for the list payload. The EF itself calls Deno.serve on
// import, so these assert on the module text rather than invoking it — the
// same shape of guard web-admin uses for its catalog columns.
import { assert, assertEquals } from "jsr:@std/assert";

const SRC = await Deno.readTextFile(
  new URL("./index.ts", import.meta.url),
);

/** The module with its prose stripped. The file EXPLAINS which keys it must
 *  no longer ship, so a naive search hits the explanation and a guard that
 *  forbids documenting its own invariant is backwards. Absence assertions read
 *  this; presence assertions can read either. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

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

Deno.test("the enrichment column is not selected at all any more", () => {
  // It was here for the intake meter and the per-function map, both of which
  // left with MESITA-1637. A jsonb blob nobody reads is bytes off the database
  // and onto the wire on every row of a 100-row page.
  assert(!CODE.includes("enrichment"), "drop the column with its last reader");
});

// ── The functions map is GONE (MESITA-1637) ─────────────────────────────
//
// This guard has now been inverted twice, and both inversions are the point.
//
// It began as `assert(!SRC.includes("functions:"))` — right while the console
// row read `Intake 3/10`. MESITA-1608 flipped it to REQUIRE the map, because
// a states matrix with one column per intake function cannot be fed by a
// high-water that stops at the first gap.
//
// MESITA-1637 flips it back, for a reason neither earlier version considered.
// Pato, 2026-09-07: "the intake states are internal." The columns are gone
// from the business matrix, and hiding the map in the client while still
// putting it in every business browser is not the same thing as internal.
//
// The spelling trap survives both flips and is why the assertion tests TWO
// strings: `intakeFunctions:` does not contain the lowercase substring
// `functions:`, so a future re-add under that spelling would sail past a
// naive guard. Forbid the wire key by name AND the fold that produces it.

Deno.test("the per-function intake map does NOT ship — intake is internal", () => {
  assert(
    !CODE.includes("enrich_functions"),
    "the wire key must be gone, not merely unrendered",
  );
  assert(
    !CODE.includes("intakeFunctions"),
    "nor may it come back under the spelling that dodges substring guards",
  );
  assert(
    !CODE.includes("operatorFunctionStates"),
    "the fold that produces the map has no caller here any more",
  );
});

Deno.test("the METER goes too — it was feeding a discarded value", () => {
  // The meter looked load-bearing and was not. The console fed it to
  // generalHeaderFacts, which computes Enriched from it, and then overrode
  // that with the EF's own isPlaceEnriched answer so the list agrees with the
  // Place screen it links to. Enriching never read the meter at all.
  assert(!CODE.includes("intakePulse"), "the high-water must not ship");
  assert(!CODE.includes("intakeTotal"), "nor its denominator");
  assert(!CODE.includes("pulseOf("), "and the reader has no caller here");
});

Deno.test("Enriching and Enriched survive, off the ROW", () => {
  // The two general columns that intake used to sit beside. They are facts
  // about the place; losing them with the machinery would be the overshoot.
  assert(CODE.includes("isPlaceEnriching("), "Enriching stays");
  assert(CODE.includes("isPlaceEnriched("), "Enriched stays");
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
  // proof and plan on a place nobody holds are withheld there — as
  // `undefined`, which renders "?", never a false "no". (Intake used to be
  // the third fact in this list; it is not withheld now, it is not sent at
  // all — MESITA-1637.)
  for (const fact of ["partner", "verified"]) {
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
    SRC.includes("[list-places] place_verifications:"),
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
