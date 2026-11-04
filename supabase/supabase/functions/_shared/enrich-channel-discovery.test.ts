import { assertEquals } from "jsr:@std/assert@1";
import { RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";

Deno.test("the production Resolver prefers this branch over the parent group", () => {
  assertEquals(RESOLVER_INSTRUCTIONS.includes("over a parent group or a branch elsewhere"), true);
  assertEquals(RESOLVER_INSTRUCTIONS.includes("MAIN account or page IS acceptable"), false);
});

// MESITA-2969: a Starbucks kiosk has no account of its own; null there is the miss.
Deno.test("the production Resolver takes the brand account when the branch has none", () => {
  assertEquals(RESOLVER_INSTRUCTIONS.includes("brand's main account IS this place's channel"), true);
  assertEquals(RESOLVER_INSTRUCTIONS.includes("unmistakably"), false);
});
