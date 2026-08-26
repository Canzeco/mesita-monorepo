import { describe, expect, it } from "vitest";

import { ENGINES, SIGNALS } from "./catalog";

describe("Discovery function APIs", () => {
  it("every signal is a stored-index function — no vendor API at rank time", () => {
    expect(SIGNALS.map((s) => [s.key, s.apis])).toEqual([
      ["proximity", []],
      ["timing", []],
      ["category", []],
      ["popularity", []],
      ["semantic", []],
      ["randomness", []],
    ]);
  });

  it("only maxKm and closedFloor are extra operator knobs", () => {
    expect(
      SIGNALS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`)),
    ).toEqual(["proximity.maxKm", "timing.closedFloor"]);
  });

  it("map() is a viewport bbox with no vendor APIs", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual([]);
    expect(map?.input).toMatch(/viewport/i);
    expect(map?.process).toMatch(/bboxPredicate/);
  });

  it("engines name only the vendor APIs they actually call", () => {
    expect(ENGINES.map((e) => [e.key, e.apis])).toEqual([
      ["swipe", []],
      ["map", []],
      ["favorites", []],
      ["catalog", []],
      ["chat", ["Google Places Text Search", "Perplexity", "OpenAI"]],
      ["social", []],
      ["name", ["Google Places Autocomplete", "Google Places Text Search", "Place Details"]],
      ["web", ["Perplexity"]],
    ]);
  });
});
