import { assertEquals } from "jsr:@std/assert@1";
import { pickZone, ZONE_MAX } from "./zone-infer.ts";

Deno.test("pickZone keeps a short neighborhood name, trimmed", () => {
  assertEquals(pickZone("  Del  Valle. "), "Del Valle");
  assertEquals(pickZone("Roma Norte", "Ciudad de México"), "Roma Norte");
});

Deno.test("pickZone refuses what is not a zone, so the stored one stays", () => {
  assertEquals(pickZone(null), null);
  assertEquals(pickZone(""), null);
  assertEquals(pickZone("null"), null);
  assertEquals(pickZone("Río Caura 350"), null);
  assertEquals(pickZone("x".repeat(ZONE_MAX + 1)), null);
  assertEquals(pickZone("Monterrey", "Monterrey"), null);
  assertEquals(pickZone("Ciudad de Mexico", "Ciudad de México"), null);
});
