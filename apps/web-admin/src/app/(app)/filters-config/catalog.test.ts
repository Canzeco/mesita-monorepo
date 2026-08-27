import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("map() is Mesita 20 ∪ Nearby 20 with opt-in fill gated by Map knobs", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual(["Google Places Nearby Search"]);
    expect(map?.input).toMatch(/guest pin/i);
    expect(map?.process).toMatch(/Closest 20 listed/);
    expect(map?.process).toMatch(/union 20–40/);
    expect(map?.process).toMatch(/opts in/);
    expect(map?.process).toMatch(/googleFill/);
    expect(map?.process).toMatch(/Type batteries/);
    expect(map?.process).toMatch(/reloadMinKm/);
    expect(map?.process).not.toMatch(/Nearest 50/);
    expect(map?.process).not.toMatch(/under 10/);
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

describe("Discovery page box order", () => {
  it("renders Name · Map · Swipe · Catalog · Chat · Social · Favs", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const surfaces = readFileSync(join(__dirname, "DiscoverySurfaceCards.tsx"), "utf8");
    const catalog = readFileSync(join(__dirname, "CatalogConfigClient.tsx"), "utf8");
    const social = readFileSync(join(__dirname, "SocialConfigClient.tsx"), "utf8");
    const chat = readFileSync(join(__dirname, "DiscoveryConfigClient.tsx"), "utf8");
    const map = readFileSync(join(__dirname, "MapConfigClient.tsx"), "utf8");

    expect(surfaces).toContain('title="Name"');
    expect(map).toContain('title="Map"');
    expect(surfaces).toContain('title="Swipe"');
    expect(catalog).toContain('title="Catalog"');
    expect(chat).toContain('title="Chat"');
    expect(social).toContain('title="Social"');
    expect(surfaces).toContain('title="Favs"');
    expect(surfaces).not.toContain('title="Favorites"');
    expect(catalog).not.toContain("SocialConfig");

    const jsx = page.slice(page.indexOf("return ("));
    const order = [
      "NameConfigCard",
      "MapConfigClient",
      "SwipeConfigCard",
      "CatalogConfigClient",
      "DiscoveryConfigClient",
      "SocialConfigClient",
      "FavsConfigCard",
    ];
    let last = -1;
    for (const name of order) {
      const idx = jsx.indexOf(name);
      expect(idx, name).toBeGreaterThan(last);
      last = idx;
    }
    expect(jsx.indexOf("FavsConfigCard")).toBeLessThan(jsx.indexOf("ConfigSoon"));
  });
});
