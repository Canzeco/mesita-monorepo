import { assertEquals } from "jsr:@std/assert@1";
import { FLEET_TESTS, testName } from "./tests.ts";

Deno.test("fleet tests: unique names, and every one has a scenario and a condition", () => {
  const names = FLEET_TESTS.map(testName);
  assertEquals(new Set(names).size, names.length);
  for (const t of FLEET_TESTS) {
    assertEquals(t.scenario.trim().length > 0, true, testName(t));
    assertEquals(t.conditions.length > 0, true, testName(t));
  }
});
