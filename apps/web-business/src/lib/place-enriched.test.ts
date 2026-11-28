import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enrichmentView, isEnrichedPlace } from "./place-enriched";

const STAMP = "2026-10-01T00:00:00Z";

describe("isEnrichedPlace — an Enrich run completed (MESITA-2154)", () => {
  it("reads a Created place (ready, no enriched_at) as NOT enriched", () => {
    expect(isEnrichedPlace({ enriched_at: null })).toBe(false);
    const created = { content_state: "ready", enriched_at: null, enrich_crenup: 1 };
    expect(isEnrichedPlace(created)).toBe(false);
    expect(isEnrichedPlace({ enriched: false, enriched_at: null })).toBe(false);
  });

  it("reads enriched_at set as enriched", () => {
    expect(isEnrichedPlace({ enriched_at: STAMP })).toBe(true);
    expect(isEnrichedPlace({ enriched: true })).toBe(true);
  });

  it("takes the server's boolean over the column, both ways", () => {
    expect(isEnrichedPlace({ enriched: false, enriched_at: STAMP })).toBe(false);
    expect(isEnrichedPlace({ enriched: true, enriched_at: null })).toBe(true);
    expect(isEnrichedPlace({ enriched_at: "  " })).toBe(false);
  });

  it("a live run is enriching, and not enriched, until the one write lands", () => {
    expect(enrichmentView({ content_state: "generating", enriched_at: STAMP })).toEqual({
      enriching: true,
      enriched: false,
    });
    expect(enrichmentView({ content_state: "ready", enriched_at: STAMP })).toEqual({
      enriching: false,
      enriched: true,
    });
    expect(enrichmentView({ content_state: "ready", enriched_at: null })).toEqual({
      enriching: false,
      enriched: false,
    });
  });

  it("is the server's rule: place-state.ts reads enriched_at, never content_state", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", "supabase", "supabase", "functions", "_shared", "place-state.ts"),
      "utf8",
    );
    const body = src.slice(src.indexOf("export function isPlaceEnriched"));
    const fn = body.slice(0, body.indexOf("\n}\n"));
    expect(fn).toContain("enrichedAt");
    expect(fn).not.toContain("content_state");
    expect(fn).not.toContain("contentState");
  });
});
