import { assertEquals } from "jsr:@std/assert@1";
import { buildResolverInput, RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";

Deno.test("the production Resolver prefers this branch over the parent group", () => {
  const input = buildResolverInput(
    { name: "Strana", locationLine: "San Pedro Garza García", category: "night_club" },
    ["website_url"],
    {},
  );
  assertEquals(input.includes("own branch wins over a parent group"), true);
  assertEquals(input.includes("MAIN account or page IS acceptable"), false);
  assertEquals(RESOLVER_INSTRUCTIONS.includes("own branch"), true);
});

// MESITA-2969: a Starbucks kiosk has no account of its own; null there is the miss.
Deno.test("the production Resolver takes the brand account when the branch has none", () => {
  const input = buildResolverInput(
    { name: "Starbucks Biblioteca ITESM MTY II", locationLine: "Monterrey", category: "cafe" },
    ["instagram_url"],
    {},
  );
  assertEquals(input.includes("the brand's account is the answer"), true);
  assertEquals(RESOLVER_INSTRUCTIONS.includes("brand's main account IS this place's channel"), true);
  assertEquals(RESOLVER_INSTRUCTIONS.includes("unmistakably"), false);
});
