import { assertEquals } from "jsr:@std/assert@1";
import { addVerdict, monthStartMexicoCity } from "./consumer-create-verdict.ts";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";

// MESITA-4681: who may add a place, the one answer the preview and Create share.
const config = normalizeEnrichmentConfig({});
const ok = { signedIn: true, reviewCount: 88, categoryAllowed: true, usedThisMonth: 3, config };

Deno.test("the Create gates default to 10 reviews, 10 a month, allowed categories only", () => {
  assertEquals(config.enrichConsumerMinGoogleReviews, 10);
  assertEquals(config.enrichConsumerCreatesPerMonth, 10);
  assertEquals(config.enrichAllowAnyGoogleCategory, false);
});

Deno.test("an anonymous visitor never adds a place", () => {
  const v = addVerdict({ ...ok, signedIn: false });
  assertEquals([v.canAdd, v.code, v.monthly], [false, "sign_in", null]);
});

Deno.test("fewer Google reviews than the minimum refuses", () => {
  assertEquals(addVerdict({ ...ok, reviewCount: 9 }).code, "below_min_reviews");
  assertEquals(addVerdict({ ...ok, reviewCount: null }).code, "below_min_reviews");
  assertEquals(addVerdict({ ...ok, reviewCount: 10 }).canAdd, true);
});

Deno.test("a category Atlas does not allow refuses unless the switch allows any", () => {
  assertEquals(addVerdict({ ...ok, categoryAllowed: false }).code, "category_not_on_mesita");
  const any = { ...config, enrichAllowAnyGoogleCategory: true };
  assertEquals(addVerdict({ ...ok, categoryAllowed: false, config: any }).canAdd, true);
});

Deno.test("the month's limit refuses at the limit and counts what is left", () => {
  assertEquals(addVerdict({ ...ok, usedThisMonth: 10 }).code, "monthly_limit");
  const v = addVerdict(ok);
  assertEquals(v.canAdd, true);
  assertEquals(v.message, "You can add 10 places a month to Mesita · 7 left.");
});

Deno.test("the month starts on the 1st at midnight in Mexico City", () => {
  // 2026-12-01 03:00 UTC is still November 30 in Mexico City.
  assertEquals(monthStartMexicoCity(new Date("2026-12-01T03:00:00Z")), "2026-11-01T06:00:00.000Z");
  assertEquals(monthStartMexicoCity(new Date("2026-12-01T07:00:00Z")), "2026-12-01T06:00:00.000Z");
});
