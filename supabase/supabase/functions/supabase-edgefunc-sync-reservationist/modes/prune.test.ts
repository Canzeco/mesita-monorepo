import { assertEquals } from "jsr:@std/assert@1";
import { retiredKeys } from "./prune.ts";

Deno.test("prune: only keys that left the fleet are retired", () => {
  assertEquals(retiredKeys({ a1: {}, a2: {}, a3: {}, a4: {} }, ["a1", "a2", "a3"]), ["a4"]);
  assertEquals(retiredKeys({ a1: {}, a2: {}, a3: {} }, ["a1", "a2", "a3"]), []);
  assertEquals(retiredKeys({}, ["a1"]), []);
});
