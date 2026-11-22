// MESITA-4454 (Discovery ranking v2). Two disclosure rules and one data rule
// Home must never break silently: a Premier place outside the rank's ad
// slots wears no "Ad"; a two-lane answer without `adIds` shows no ads; and a
// new config `updatedAt` drops every mode's kept list and seed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { AreaPool } from "@/lib/api/places";
import {
  acceptRank,
  bumpSeen,
  dropBoughtOffers,
  isAdPlace,
  oftenSeen,
  modePoolFor,
  rankModeForChip,
  readModePool,
  readRankAdIds,
  resetCatalogModes,
  seedFor,
} from "@/lib/catalog-modes";

const pool = (order: string[], adIds: string[] = [], places: AreaPool["places"] = []): AreaPool => ({
  kind: "point",
  places,
  order,
  asked: 0,
  rankedFrom: null,
  adIds,
  preShuffle: {},
});

beforeEach(() => resetCatalogModes());

describe("the Ad mark (H4, M-d)", () => {
  it("a Premier place not in adIds is not an ad, whatever its own flag says", () => {
    const ads = new Set(["ad-1"]);
    expect(isAdPlace({ id: "premier-organic" }, ads)).toBe(false);
    expect(isAdPlace({ id: "premier-organic", ad: true }, ads)).toBe(false);
    expect(isAdPlace({ id: "ad-1" }, ads)).toBe(true);
    // With no rank list (a Map pin), only the place's own `ad: true` counts.
    expect(isAdPlace({ id: "x" })).toBe(false);
    expect(isAdPlace({ id: "x", ad: true })).toBe(true);
  });

  it("a two-lane answer without adIds is refused: no ads", () => {
    expect(readRankAdIds({ lanes: true })).toEqual({ adIds: [], refused: true });
    expect(readRankAdIds({ lanes: true, adIds: [1] })).toEqual({ adIds: [], refused: true });
    expect(readRankAdIds({ lanes: true, adIds: ["a", "a"] })).toEqual({ adIds: ["a"], refused: false });
    // An older EF (no lanes) simply has none.
    expect(readRankAdIds({})).toEqual({ adIds: [], refused: false });
  });
});

describe("per-mode seeds and lists (C2, M-a, DX-b)", () => {
  const tec = { lat: 25.6512, lng: -100.2891 };

  it("keeps a mode's seed within 300 m and re-seeds past it", () => {
    let n = 7;
    const draw = () => n++;
    const first = seedFor("nearby", tec, draw);
    expect(first).toEqual({ seed: 7, point: tec });
    // ~110 m north: same seed, the seed's point still ranks.
    expect(seedFor("nearby", { lat: tec.lat + 0.001, lng: tec.lng }, draw)).toEqual(first);
    // ~550 m: a new seed at the new point.
    const moved = { lat: tec.lat + 0.005, lng: tec.lng };
    expect(seedFor("nearby", moved, draw)).toEqual({ seed: 8, point: moved });
    // Another mode has its own seed.
    expect(seedFor("popular", tec, draw).seed).toBe(9);
  });

  it("a new config updatedAt drops every mode's list and seed", () => {
    const rec = seedFor("nearby", tec, () => 1);
    acceptRank("g", "nearby", rec, pool(["a"]), "2026-11-19T00:00:00Z");
    const popRec = seedFor("popular", tec, () => 2);
    acceptRank("g", "popular", popRec, pool(["b"]), "2026-11-19T00:00:00Z");
    expect(modePoolFor("g", "nearby", rec)?.order).toEqual(["a"]);

    // The same config keeps both.
    const again = seedFor("family:coffee", tec, () => 3);
    expect(acceptRank("g", "family:coffee", again, pool(["c"]), "2026-11-19T00:00:00Z")).toBe(false);
    expect(readModePool("g", "popular")?.order).toEqual(["b"]);

    // A changed config: every other mode's list and seed are gone.
    const fresh = seedFor("family:coffee", tec, () => 4);
    expect(acceptRank("g", "family:coffee", fresh, pool(["d"]), "2026-11-20T00:00:00Z")).toBe(true);
    expect(readModePool("g", "nearby")).toBeNull();
    expect(readModePool("g", "popular")).toBeNull();
    expect(readModePool("g", "family:coffee")?.order).toEqual(["d"]);
    expect(seedFor("nearby", tec, () => 99).seed).toBe(99);
  });

  it("a kept list counts only for the seed and point it was ranked with", () => {
    const rec = seedFor("popular", tec, () => 5);
    acceptRank("g", "popular", rec, pool(["a"]), null);
    expect(modePoolFor("g", "popular", rec)).not.toBeNull();
    expect(modePoolFor("g", "popular", { seed: 6, point: tec })).toBeNull();
    // Another guest never reads it (offers are per guest).
    expect(readModePool("other", "popular")).toBeNull();
  });
});

describe("rankModeForChip twin (DX-c)", () => {
  it("near → nearby, all → popular, a family → family", () => {
    expect(rankModeForChip("near")).toBe("nearby");
    expect(rankModeForChip("all")).toBe("popular");
    expect(rankModeForChip("coffee")).toBe("family");
  });

  it("has the same body as _shared/pipeline-signals.ts", () => {
    const body = (src: string) => {
      const at = src.indexOf("export function rankModeForChip(");
      expect(at).toBeGreaterThan(-1);
      return src.slice(at, src.indexOf("\n}\n", at) + 2);
    };
    const shared = readFileSync(
      join(__dirname, "../../../../../supabase/supabase/functions/_shared/pipeline-signals.ts"),
      "utf8",
    );
    const here = readFileSync(join(__dirname, "../catalog-modes.ts"), "utf8");
    expect(body(here)).toBe(body(shared));
  });
});

describe("a paid voucher leaves Home at once (MESITA-4209)", () => {
  const tec = { lat: 25.6512, lng: -100.2891 };

  it("drops that voucher from every pool's card and keeps the rest", () => {
    const rec = seedFor("nearby", tec, () => 1);
    const places = [
      { id: "p1", name: "A", offers: { sell: ["voucher_story", "voucher_200"] } },
      { id: "p2", name: "B", offers: { sell: ["voucher_story"] } },
    ] as AreaPool["places"];
    acceptRank("g", "nearby", rec, pool(["p1", "p2"], [], places), null);
    acceptRank("other", "popular", seedFor("popular", tec, () => 2), pool(["p1"], [], places), null);
    dropBoughtOffers("p1", ["voucher_story"]);
    expect(readModePool("g", "nearby")?.places.map((p) => p.offers?.sell ?? null)).toEqual([
      ["voucher_200"],
      ["voucher_story"],
    ]);
    expect(readModePool("other", "popular")?.places[0]?.offers?.sell).toEqual(["voucher_200"]);
    expect(readModePool("g", "nearby")?.order).toEqual(["p1", "p2"]);
  });
});

describe("seen memory (MESITA-4459)", () => {
  it("sends a place only after it has been shown three times", () => {
    let counts = bumpSeen({}, ["a"]);
    counts = bumpSeen(counts, ["a"]);
    expect(oftenSeen(counts)).toEqual([]);
    counts = bumpSeen(counts, ["a", "b"]);
    expect(oftenSeen(counts)).toEqual(["a"]);
  });
});
