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

  it("engines name only the vendor APIs they actually call", () => {
    expect(ENGINES.map((e) => [e.key, e.apis])).toEqual([
      ["swipe", []],
      ["map", ["Google Places Autocomplete", "Place Details"]],
      ["favorites", []],
      ["catalog", []],
      ["chat", ["Google Places Text Search", "Perplexity", "OpenAI"]],
      ["social", []],
      ["name", []],
      ["web", ["Perplexity"]],
    ]);
  });
});
