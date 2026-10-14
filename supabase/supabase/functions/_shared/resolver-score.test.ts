import { assertEquals } from "jsr:@std/assert@1";
import { buildResolverInput, RESOLVER_INSTRUCTIONS } from "./enrich-channel-discovery.ts";
import { scoreTrio } from "./resolver-score.ts";

const TRUTH = {
  website: "https://www.stranagdl.com/",
  instagram: "https://www.instagram.com/stranagdl_oficial",
  facebook: "https://www.facebook.com/stranagdl/",
};

Deno.test("scoring treats host, www, and a trailing slash as the same channel", () => {
  assertEquals(
    scoreTrio({
      website: "https://stranagdl.com",
      instagram: "https://instagram.com/stranagdl_oficial/?hl=en",
      facebook: "http://www.facebook.com/stranagdl",
    }, TRUTH),
    { website: "correct", instagram: "correct", facebook: "correct" },
  );
});

Deno.test("a parent site is a false positive when the branch has no site of its own", () => {
  assertEquals(
    scoreTrio(
      { website: "https://grupoalme.mx/", instagram: null, facebook: null },
      { website: null, instagram: "https://www.instagram.com/stranasanpedro_oficial/", facebook: null },
    ),
    { website: "false_positive", instagram: "missed", facebook: "correct" },
  );
});

Deno.test("another branch's handle is the wrong entity", () => {
  assertEquals(
    scoreTrio(
      { website: null, instagram: "https://www.instagram.com/stranagdl_oficial", facebook: null },
      { website: null, instagram: "https://www.instagram.com/stranavallarta_oficial/", facebook: null },
    ).instagram,
    "wrong_entity",
  );
});

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
