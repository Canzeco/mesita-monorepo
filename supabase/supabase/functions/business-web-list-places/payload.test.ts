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

// ── Visit Rewards is a STRATEGY, not a column (MESITA-1882) ─────────────
//
// The console's Products grid used to hardcode Rewards as Enabled for every
// partnered org, because no rewards fact was on this payload to read. A place
// sitting on Zero therefore read "Enabled" while serving 0% — and, since
// `listing_type='partner'` is `plan ≠ free ∧ strategy ≠ zero`, while carrying
// no Partner badge in the consumer app either.
//
// The fix has one hazard worth a test: there is no `visit_rewards` boolean to
// select, so the fact has to be DERIVED from the four rate columns. Derived
// twice and it drifts, and the drift is silent — the grid says Enabled, the
// guest app says nothing. So this pins the derivation to the shared reader.
Deno.test("visitRewards derives through the shared strategy reader", () => {
  assert(
    SRC.includes("strategyForRates("),
    "visitRewards must call the shared strategyForRates",
  );
  assert(
    SRC.includes("ratesFromPlace("),
    "the rates must be read by the shared ratesFromPlace",
  );
  assert(
    /from "\.\.\/_shared\/promo-strategy\.ts"/.test(SRC),
    "both must come from _shared/promo-strategy.ts, not a local copy",
  );
  // The preset tuples live in promo-strategy.ts and NOWHERE else. A literal
  // rate here would be a fifth copy of the ladder.
  for (const rate of ["welcome_free_rate:", "welcome_premium_rate:"]) {
    assert(
      !new RegExp(`${rate}\\s*\\d`).test(CODE),
      `${rate} must not carry a literal preset value in this EF`,
    );
  }
});

Deno.test("the four rate columns are selected — they ARE the rewards fact", () => {
  for (
    const column of [
      "welcome_free_rate",
      "welcome_premium_rate",
      "free_rate",
      "premium_rate",
    ]
  ) {
    assert(CODE.includes(column), `${column} must be in the select`);
  }
  // The BOOLEAN ships, never the rates: what a place pays has never been on
  // this wire. If any of these ever appears as a payload key, that changed.
  assert(
    !/\n\s*(welcome_)?(free|premium)_?[Rr]ate:/.test(
      SRC.slice(SRC.indexOf("visitRewards")),
    ),
    "a rate must never become a payload field",
  );
});

Deno.test("the enrichment column is selected — it feeds enrichFunctions", () => {
  // Re-added by MESITA-1687. The embed carries `place_profiles.enrichment`
  // so the per-function map can be folded with no second query — the same
  // column admin-web-search-places already reads via a side query.
  assert(CODE.includes("enrichment"), "the embed must select the column");
});

// ── The functions map is BACK (MESITA-1687) ─────────────────────────────
//
// This guard has now been inverted three times, and every inversion is the
// point.
//
// It began as `assert(!SRC.includes("functions:"))` — right while the console
// row read `Crenup 3/8`. MESITA-1608 flipped it to REQUIRE the map, because
// a states matrix with one column per Crenup function cannot be fed by a
// high-water that stops at the first gap. MESITA-1637 flipped it back:
// Pato, 2026-09-07, "the Crenup states are internal."
//
// MESITA-1687 reverses that reversal. Pato, 2026-09-08: ship it to everyone;
// the console's own collapse toggle (default hidden) is the thing that keeps
// it out of sight now, not a server-side withhold.

Deno.test("the per-function Crenup map DOES ship, guarded", () => {
  assert(
    CODE.includes("enrichFunctions"),
    "the wire key must be back, camelCase like every other field on this row",
  );
  assert(
    CODE.includes("operatorFunctionStates"),
    "folded through the same shared reader admin-web-search-places uses",
  );
});

Deno.test("the METER goes too — it was feeding a discarded value", () => {
  // The meter looked load-bearing and was not. The console fed it to
  // generalHeaderFacts, which computes Enriched from it, and then overrode
  // that with the EF's own isPlaceEnriched answer so the list agrees with the
  // Place screen it links to. Enriching never read the meter at all.
  assert(!CODE.includes("crenupPulse"), "the high-water must not ship");
  assert(!CODE.includes("crenupTotal"), "nor its denominator");
  assert(!CODE.includes("pulseOf("), "and the reader has no caller here");
});

Deno.test("Enriching and Enriched survive, off the ROW", () => {
  // The two general columns that Crenup used to sit beside. They are facts
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
    "mine and all share one clearance predicate; two copies would drift",
  );
  // The gate is the CALLER's clearance, not whether a row is held. Keying it
  // off the row would blank half the matrix on the one screen built to
  // compare held places against claimable ones.
  assert(
    !/scope === "mine" \? isPaidPlan/.test(SRC),
    "the fact gate must read memberScope, not scope === mine",
  );
  // MESITA-1892: there is nothing left to name and nothing left to prove
  // membership in. The clearance is the caller's own portfolio — a
  // place_members row, or super-admin — which is narrower than the tenant
  // check it replaces, never wider. (`_shared/no-organization-layer.test.ts`
  // is the repo-wide guard on the retired names; this one pins what replaced
  // them.)
  assert(
    SRC.includes("myPlaceIds.size > 0") && SRC.includes("superAdmin"),
    "clearance is holding a place, or being staff",
  );
});

Deno.test("scope=all is MY places OR the unheld ones", () => {
  assert(
    SRC.includes("q.or(`id.in.(${mineList.join(\",\")}),claimed_at.is.null`)"),
    "all = held by me, or held by nobody",
  );
  // `eq.null` is not a null test in PostgREST and would match nothing.
  assert(!SRC.includes("claimed_at.eq.null"), "null needs is.null");
  // And an empty portfolio cannot build `id.in.()`, which PostgREST rejects.
  assert(
    SRC.includes("mineList.length === 0"),
    "the union must collapse to the pool half when I hold nothing",
  );
});

Deno.test("the direct-owner filter spares rows I hold", () => {
  // placeIdsWithDirectOwner is the shared claim predicate: a place with a
  // place_members owner is not claimable even with claimed_at null, because
  // it was owned the old way and never passed through the pool. On scope=all
  // it must not strip the caller's OWN rows, which are held by definition and
  // would otherwise vanish from their own list.
  assert(
    SRC.includes("myPlaceIds.has(r.id) || !isHeld(r)"),
    "held rows survive the pool predicate",
  );
  assert(
    SRC.includes("placeIdsWithDirectOwner("),
    "the owner half comes from the shared predicate, not a local query",
  );
});

Deno.test("pool rows withhold the facts a guest has no claim to", () => {
  // getAuthedUser accepts ANY valid bearer token and the backend is a
  // singleton, so every consumer account can call scope=public. Ownership
  // proof, plan, and now the Crenup map on a place nobody holds are withheld
  // there — as `undefined`, which renders "?", never a false "no". Pato's
  // "ship it to everyone" (MESITA-1687) meant every BUSINESS browser, and
  // memberScope is exactly that gate — the same one partner/verified already
  // use, so the map does not go further than they do.
  // visitRewards joined them in MESITA-1882: what discount a place gives is
  // the same class of commercial fact as what plan it pays for.
  for (const fact of ["partner", "verified", "enrichFunctions", "visitRewards"]) {
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

Deno.test("no holder name rides the row any more", () => {
  // The row used to carry the holding tenant's `name` so it could say who held
  // it without a second request. A place is held by the ACCOUNT that claimed
  // it now, and the only held rows this endpoint returns are the caller's own
  // — so a holder name could only repeat the caller back at themselves, and
  // joining `managers` to build one would put another operator's name on a
  // wire that never needed it.
  assert(
    (CODE.match(/!inner\(/g) ?? []).length === 1,
    "one embed only (place_profiles); a holder relation would be a second",
  );
  assert(!CODE.includes("managers"), "no operator identity joins this list");
  // WHEN is still a fact about the place, and the console shows it.
  assert(CODE.includes("claimedAt:"), "claimedAt stays on the row");
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

// ── THE SHELL'S ENVELOPE, AND THE HELD-ONLY FACTS (MESITA-1892) ───────────
//
// THIS IS THE SEAM NOTHING ELSE CAN SEE. `business-web-list-organizations` was
// deleted and the console's shell reads THIS endpoint instead, so two
// console-wide facts that used to ride the organizations payload now ride
// here — and the held-only facts the organization row carried are on the
// place. The client reaches them through `invokeEF<ConsoleViewer>`, which is
// an UNCHECKED CAST: if this endpoint stops shipping a key, web-business
// type-checks green, builds green, and renders `undefined` in production.
// These assertions are the only thing standing between that and a shipped
// console with no Admin row and no Membership price.
//
// The mirror is apps/web-business/src/lib/api/console.ts — `ConsoleViewer`
// and the HELD ONLY block of `ConsolePlace`.

Deno.test("the envelope carries the two console-wide facts", () => {
  assert(
    /isSuperAdmin:\s*superAdmin/.test(CODE),
    "the shell learns whether the Admin row exists from this payload",
  );
  assert(
    CODE.includes("membershipPrice,"),
    "the Membership's catalog price rides the envelope, not every row",
  );
  assert(
    CODE.includes('.from("membership_plans")'),
    "the price comes from the catalog row Stripe is provisioned from",
  );
});

Deno.test("held-only facts ship, and only to a reader who holds the place", () => {
  for (
    const key of [
      "myRole:",
      "legalName:",
      "rfc:",
      "currency:",
      "partnered:",
      "mesitaPayEnabled:",
      "membership:",
    ]
  ) {
    assert(CODE.includes(key), `payload must carry ${key}`);
  }
  // The gate is per-PLACE membership, not merely "is a business caller".
  // `memberScope` would leak a venue's RFC to anyone holding any other place.
  assert(
    /canSeeHeldFacts\(r\.id\)\s*\n?\s*\?/.test(CODE) ||
      CODE.includes("...(canSeeHeldFacts(r.id)"),
    "held-only facts must be gated on canSeeHeldFacts(r.id)",
  );
  assert(
    /const canSeeHeldFacts = \(id: string\) =>\s*superAdmin \|\| myPlaceIds\.has\(id\)/
      .test(CODE),
    "canSeeHeldFacts is a place_members row for THAT place, or super-admin",
  );
});

Deno.test("the legal person is selected from places, not looked up twice", () => {
  // These were columns on the organization row. They are columns on the place
  // now, so they cost no extra read — and a second query for them would be a
  // round trip per render of the console shell.
  assert(
    CODE.includes("partnered, legal_name, rfc, currency,"),
    "the held-only columns ride the select that was already happening",
  );
});

Deno.test("the live membership is read once, batched, and degrades to null", () => {
  assert(
    CODE.includes('.from("partner_memberships")'),
    "the billing behind `partnered` is read from the mirror table",
  );
  assert(
    CODE.includes("LIVE_MEMBERSHIP_STATES"),
    "live means the same two states the one-live unique index is built on",
  );
  assert(
    /chunked\(heldIds, ID_CHUNK\)/.test(CODE),
    "batched with .in(), never one query per row",
  );
  assert(
    CODE.includes("membershipByPlace.get(r.id) ?? null"),
    "a place with no live membership ships null, not undefined",
  );
  assert(
    CODE.includes("membershipByPlace.clear()"),
    "a failed read ships null everywhere rather than a partial map",
  );
});
