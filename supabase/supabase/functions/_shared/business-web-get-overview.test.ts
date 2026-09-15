// The overview's reads must stay OVERLAPPED (MESITA-1876).
//
// This EF is the Place screen's hard load, and it used to run seven queries in
// a row for an ordinary operator — p50 472ms measured over 24h, on a project
// where a call costs far more than the query inside it. Three of those reads
// need only the user id and now start together.
//
// A SOURCE TEST, deliberately. There is no way to assert "these ran in
// parallel" from outside without a live database and a stopwatch; what CAN be
// pinned is the shape that makes it true, and the shape is exactly what a
// later reader would undo. Every assertion below names a specific regression:
// re-awaiting a read at its old call site, or dropping the guard that keeps a
// discarded promise from taking the isolate down.
import { assertEquals } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(
  new URL("../business-web-get-overview/index.ts", import.meta.url),
);

/** Comments name what they deleted, so a "not present" assertion must never
 *  pass or fail on somebody explaining themselves. */
const CODE = SRC.split("\n")
  .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
  .join("\n");

Deno.test("the reads that need only the user id start before the branch", () => {
  for (const started of ["superAdminP", "memberRowsP", "orgRowsP", "rewardsConfigP", "pinRowP"]) {
    assertEquals(CODE.includes(`const ${started}`), true, `${started} is kicked off`);
  }
  // The branch reads the promise, never the table again. `await admin.from(
  // "place_members"…)` at the old call site is the regression this catches.
  assertEquals(CODE.includes("await memberRowsP"), true);
  assertEquals(CODE.includes("await orgRowsP"), true);
  assertEquals(CODE.includes("await rewardsConfigP"), true);
  assertEquals(CODE.includes('await admin\n      .from("place_members")'), false);
  assertEquals(CODE.includes('await admin\n      .from("organization_members")'), false);
});

Deno.test("app_config no longer blocks the response at the end", () => {
  // It depends on nothing in this function. Its only remaining job is to be
  // awaited where its value is used, which is the last thing the payload needs.
  const kickoff = CODE.indexOf("const rewardsConfigP");
  const use = CODE.indexOf("await rewardsConfigP");
  assertEquals(kickoff > -1 && use > kickoff, true);
  // And the read itself happens ONCE.
  assertEquals((CODE.match(/from\("app_config"\)/g) ?? []).length, 1);
});

Deno.test("the pin row is speculated on the requested id, with a real fallback", () => {
  // Speculation without the fallback would hand back the WRONG place's PIN
  // whenever `active` is not the requested place — a staff secret, on the
  // owner-only branch. The equality check is the whole safety of it.
  assertEquals(CODE.includes("activeId === requestedPlaceId"), true);
  assertEquals(CODE.includes("await pinRowP"), true);
  // The fallback query still exists for the case that misses.
  assertEquals((CODE.match(/select\("check_pin"\)/g) ?? []).length, 2);
});

Deno.test("a speculative read can never take the isolate down", () => {
  // A super-admin takes neither membership result, and the pin promise is
  // discarded when `active` falls back. A floating promise that rejects is an
  // unhandled rejection: a 500 with no body, for a super-admin, on a transient
  // blip, in a branch nobody reads.
  assertEquals(CODE.includes("function fireAndForgettable"), true);
  // `rewardsConfigP` is in this list for a reason that is easy to miss: it is
  // always awaited on the HAPPY path, and every early return above it — the
  // super-admin 400, the 404, the two 500s — leaves it floating. An error
  // response is when a second unhandled rejection is least welcome.
  for (const speculative of ["memberRowsP", "orgRowsP", "pinRowP", "rewardsConfigP"]) {
    const at = CODE.indexOf(`const ${speculative}`);
    const decl = CODE.slice(at, at + 260);
    assertEquals(
      decl.includes("fireAndForgettable("),
      true,
      `${speculative} is guarded`,
    );
  }
  // The guard must not swallow the value for a caller that DOES await it —
  // the catch rides a derived promise, and the original is returned.
  assertEquals(CODE.includes("q.catch(() => {});"), true);
  assertEquals(CODE.includes("return q;"), true);
});
