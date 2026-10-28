// Render (render/, Node) cannot import _shared, so it carries copies of a few
// pure helpers. One table, render-twins.fixture.json, pins both sides: this
// test runs it through _shared, render/src/twins.test.ts through Render's
// copies, so a change to either copy alone fails its own suite. Change a twin
// = change both copies and this fixture together.
import { assertEquals } from "jsr:@std/assert@1";
import fixture from "./render-twins.fixture.json" with { type: "json" };
import { closesAtFromHours, type GooglePeriod, weeklyHoursFromPeriods } from "./enrich-google-hours.ts";
import { type GooglePriceRange, priceLevelFromGoogle } from "./enrich-google-basics-normalizers.ts";
import { DEFAULT_IMAGE_ANALYSIS_PROMPT, DEFAULT_IMAGE_SORTING_PROMPT } from "./enrichment-config.ts";
import { vectorLiteral } from "./embeddings-vector.ts";

Deno.test("twin: weeklyHoursFromPeriods matches the Render fixture", () => {
  for (const c of fixture.hours) {
    assertEquals(weeklyHoursFromPeriods((c.periods ?? undefined) as GooglePeriod[] | undefined), c.expected, JSON.stringify(c.periods));
  }
});

Deno.test("twin: closesAtFromHours matches the Render fixture", () => {
  for (const c of fixture.closesAt) assertEquals(closesAtFromHours(c.lines), c.expected, JSON.stringify(c.lines));
});

Deno.test("twin: priceLevelFromGoogle matches the Render fixture", () => {
  for (const c of fixture.priceLevel) {
    const got = priceLevelFromGoogle(c.value ?? undefined, (c.range ?? undefined) as GooglePriceRange | undefined);
    assertEquals(got, c.expected, JSON.stringify(c));
  }
});

Deno.test("twin: vectorLiteral matches the Render fixture", () => {
  for (const c of fixture.vectorLiteral) assertEquals(vectorLiteral(c.values), c.expected);
});

Deno.test("twin: default image prompts match the Render fixture", () => {
  assertEquals(DEFAULT_IMAGE_ANALYSIS_PROMPT, fixture.imagePrompts.analysis);
  assertEquals(DEFAULT_IMAGE_SORTING_PROMPT, fixture.imagePrompts.sorting);
});
