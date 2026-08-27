import { describe, expect, it } from "vitest";

import {
  coerceConfig,
  DEFAULT_CATALOG,
  DEFAULT_MAP,
  DEFAULT_SOCIAL,
  ENGINES,
  SIGNALS,
} from "./catalog";

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

  it("map() is three closest-N lanes then one catalog", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual(["Google Places Nearby Search"]);
    expect(map?.input).toMatch(/guest pin/i);
    expect(map?.process).toMatch(/Partners/);
    expect(map?.process).toMatch(/Mesita/);
    expect(map?.process).toMatch(/Google/);
    expect(map?.process).toMatch(/overlaps/);
    expect(map?.process).toMatch(/reloadMinKm/);
    expect(map?.process).not.toMatch(/Nearest 50/);
    expect(map?.process).not.toMatch(/under 10/);
  });

  it("coerceConfig defaults map lane caps on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).map.partnerCount).toBe(10);
    expect(coerceConfig({ weights: {}, slotting: {} }).map.mesitaCount).toBe(10);
    expect(coerceConfig({ weights: {}, slotting: {} }).map.googleCount).toBe(20);
    expect(coerceConfig({ map: { partnerCount: 99, googleCount: -1 } }).map).toMatchObject({
      partnerCount: 20,
      mesitaCount: 10,
      googleCount: 0,
    });
    expect(coerceConfig({ map: { notPartnerCount: 7 } }).map.mesitaCount).toBe(7);
  });

  it("catalog() is live rails over Mesita search, no vendor API", () => {
    const catalog = ENGINES.find((e) => e.key === "catalog");
    expect(catalog?.state).toBe("LIVE");
    expect(catalog?.apis).toEqual([]);
    expect(catalog?.process).toMatch(/vibe-query/i);
    expect(catalog?.process).not.toMatch(/Parked/i);
  });

  it("coerceConfig defaults catalog on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).catalog).toEqual(DEFAULT_CATALOG);
    expect(coerceConfig({ catalog: { seedCount: 99 } }).catalog.seedCount).toBe(20);
  });

  it("coerceConfig defaults map on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).map).toEqual(DEFAULT_MAP);
    expect(
      coerceConfig({
        map: { minRating: 9, minPopularity: 4, types: { restaurant: false } },
      }).map,
    ).toEqual({
      ...DEFAULT_MAP,
      minRating: 5,
      minPopularity: 1,
      types: { ...DEFAULT_MAP.types, restaurant: false },
    });
  });

  it("coerceConfig defaults social on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).social).toEqual(DEFAULT_SOCIAL);
    expect(coerceConfig({ social: { seedCount: 99, horizonDays: 400 } }).social).toEqual({
      ...DEFAULT_SOCIAL,
      seedCount: 20,
      horizonDays: 90,
    });
  });

  it("social() stays parked and names events, not places", () => {
    const social = ENGINES.find((e) => e.key === "social");
    expect(social?.state).toBe("PARKED");
    expect(social?.process).toMatch(/events/i);
    expect(social?.input).toMatch(/events/i);
    expect(social?.process).not.toMatch(/Check-ins/);
  });

  it("chat() is live OpenAI conversation — tools come later", () => {
    const chat = ENGINES.find((e) => e.key === "chat");
    expect(chat?.state).toBe("LIVE");
    expect(chat?.apis).toEqual(["OpenAI"]);
  });

  it("engines name only the vendor APIs they actually call", () => {
    expect(ENGINES.map((e) => [e.key, e.apis])).toEqual([
      ["swipe", []],
      ["map", ["Google Places Nearby Search"]],
      ["favorites", []],
      ["catalog", []],
      ["chat", ["OpenAI"]],
      ["social", []],
      ["name", ["Google Places Autocomplete", "Google Places Text Search", "Place Details"]],
      ["web", ["Perplexity"]],
    ]);
  });
});
