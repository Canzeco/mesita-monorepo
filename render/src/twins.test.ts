// Render's copies of supabase _shared helpers, pinned by the same table the
// supabase suite runs (_shared/render-twins.fixture.json, render-twins.test.ts).
// A failure here means this copy drifted from its _shared twin: change both.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { priceLevelFromGoogle } from "./channels.ts";
import { vectorLiteral } from "./embedding.ts";
import { capPresentation, PRESENTATION_MAX } from "./google-spine.ts";
import { closesAtFromHours, type GooglePeriod, weeklyHoursFromPeriods } from "./hours.ts";
import { defaultImageKnobs } from "./images.ts";

type Fixture = {
  hours: { periods: GooglePeriod[] | null; expected: unknown }[];
  closesAt: { lines: string[]; expected: string | null }[];
  priceLevel: { value: string | null; range: Parameters<typeof priceLevelFromGoogle>[1] | null; expected: number | null }[];
  vectorLiteral: { values: number[]; expected: string }[];
  imagePrompts: { analysis: string; sorting: string };
  presentation: { max: number; cases: { note: string; text: [string, number][]; expected: [string, number][] }[] };
};

/** Fixture text is [chunk, times] pairs, so a 2,300-character case stays one line. */
const build = (parts: [string, number][]) => parts.map(([s, n]) => s.repeat(n)).join("");

const fixture = JSON.parse(
  readFileSync(new URL("../../supabase/supabase/functions/_shared/render-twins.fixture.json", import.meta.url), "utf8"),
) as Fixture;

test("twin: weeklyHoursFromPeriods matches _shared/enrich-google-hours.ts", () => {
  for (const c of fixture.hours) {
    assert.deepEqual(weeklyHoursFromPeriods(c.periods ?? undefined), c.expected, JSON.stringify(c.periods));
  }
});

test("twin: closesAtFromHours matches _shared/enrich-google-hours.ts", () => {
  for (const c of fixture.closesAt) assert.equal(closesAtFromHours(c.lines), c.expected, JSON.stringify(c.lines));
});

test("twin: priceLevelFromGoogle matches _shared/enrich-google-basics-normalizers.ts", () => {
  for (const c of fixture.priceLevel) {
    assert.equal(priceLevelFromGoogle(c.value ?? undefined, c.range ?? undefined), c.expected, JSON.stringify(c));
  }
});

test("twin: vectorLiteral matches _shared/embeddings-vector.ts", () => {
  for (const c of fixture.vectorLiteral) assert.equal(vectorLiteral(c.values), c.expected);
});

test("twin: default image prompts match _shared/enrichment-config.ts", () => {
  const knobs = defaultImageKnobs();
  assert.equal(knobs.imageAnalysisPrompt, fixture.imagePrompts.analysis);
  assert.equal(knobs.imageSortingPrompt, fixture.imagePrompts.sorting);
});

test("twin: capPresentation and PRESENTATION_MAX match _shared/presentation-cap.ts", () => {
  assert.equal(PRESENTATION_MAX, fixture.presentation.max);
  for (const c of fixture.presentation.cases) {
    assert.equal(capPresentation(build(c.text)), build(c.expected), c.note);
  }
});
