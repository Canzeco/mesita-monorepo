import { assertEquals } from "jsr:@std/assert@1";
import { retiredByName, retiredKeys } from "./prune.ts";

Deno.test("prune: only keys that left the fleet are retired", () => {
  assertEquals(retiredKeys({ a1: {}, a2: {}, a3: {}, a4: {} }, ["a1", "a2", "a3"]), ["a4"]);
  assertEquals(retiredKeys({ a1: {}, a2: {}, a3: {} }, ["a1", "a2", "a3"]), []);
  assertEquals(retiredKeys({}, ["a1"]), []);
});

Deno.test("prune: a retired fleet agent is found by its name; other agents are left alone", () => {
  const listed = [
    { agent_id: "agent_a3", name: "eleven-a3 (es-mx) · inbound" },
    { agent_id: "agent_a4", name: "eleven-a4 (es-mx) · business inbound" },
    { agent_id: "agent_x", name: "Chambi Worker Interviewer" },
  ];
  assertEquals(retiredByName(listed, ["a1", "a2", "a3"]), [{ key: "a4", id: "agent_a4" }]);
});
