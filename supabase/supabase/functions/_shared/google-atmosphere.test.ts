import { assertEquals } from "jsr:@std/assert@1";
import { googleTagsFromAtmosphere } from "./google-atmosphere.ts";

Deno.test("only true atmosphere booleans become google_tags, in field order", () => {
  assertEquals(
    googleTagsFromAtmosphere({
      liveMusic: true,
      takeout: true,
      dineIn: false,
      delivery: true,
      servesCoffee: "yes",
      outdoorSeating: true,
      restroom: null,
    }),
    ["takeout", "delivery", "outdoor_seating", "live_music"],
  );
});

Deno.test("a place with no atmosphere booleans stores no tags", () => {
  assertEquals(googleTagsFromAtmosphere({}), []);
  assertEquals(googleTagsFromAtmosphere({ takeout: false }), []);
});
