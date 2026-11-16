// modes/tests.test.ts — which simulated calls run_tests runs (MESITA-4134).
//
// Pinned because it is money: every simulated call spends ElevenLabs
// credits. A named run must run only the named calls, and a typo must be
// an error, never the whole suite.

import { assertEquals } from "jsr:@std/assert@1";
import { pickTests } from "./tests.ts";
import { FLEET_TESTS, testName } from "../../_shared/reservationist/tests.ts";

const first = FLEET_TESTS[0];

Deno.test("a named call runs alone, by label or by full name", () => {
  for (const name of [first.label, testName(first)]) {
    const got = pickTests({ tests: [name] });
    assertEquals(got.ok && got.tests.map(testName), [testName(first)]);
  }
});

Deno.test("an unknown label is an error, never the whole suite", () => {
  const got = pickTests({ tests: [first.label, "no such call"] });
  assertEquals(got.ok, false);
  assertEquals(pickTests({ tests: [] }).ok, false);
});

Deno.test("no tests field keeps the old meaning: one agent's, or all", () => {
  const a1 = pickTests({ agent: "a1" });
  assertEquals(a1.ok && a1.tests.every((t) => t.agent === "a1"), true);
  const all = pickTests({});
  assertEquals(all.ok && all.tests.length, FLEET_TESTS.length);
});
