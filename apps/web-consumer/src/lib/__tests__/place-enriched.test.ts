import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isEnrichedPlace } from "@/lib/place-enriched";

const SHARED = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "supabase",
  "supabase",
  "functions",
  "_shared",
);

function fnBody(src: string, signature: string): string {
  const from = src.slice(src.indexOf(signature));
  return from.slice(0, from.indexOf("\n}\n"));
}

describe("isEnrichedPlace — an Enrich run completed (MESITA-2154)", () => {
  it("reads a Created place (ready, no enriched_at) as NOT enriched", () => {
    const created = { content_state: "ready", enriched_at: null };
    expect(isEnrichedPlace(created)).toBe(false);
    expect(isEnrichedPlace({ ...created, enriched: false })).toBe(false);
  });

  it("reads enriched_at set as enriched", () => {
    expect(isEnrichedPlace({ enriched_at: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isEnrichedPlace({ enriched: true })).toBe(true);
  });

  it("states the server's one rule: every server reader goes through isPlaceEnriched", () => {
    const state = readFileSync(join(SHARED, "place-state.ts"), "utf8");
    const rule = fnBody(state, "export function isPlaceEnriched");
    expect(rule).toContain("enrichedAt");
    expect(rule).not.toContain("content_state");

    // The consumer wire `enriched` and the Map ring both delegate to it.
    const wire = fnBody(
      readFileSync(join(SHARED, "place-family-keys.ts"), "utf8"),
      "export function isEnrichedPlace",
    );
    expect(wire).toContain("isPlaceEnriched(");
    expect(wire).not.toContain("content_state");
    const ring = fnBody(
      readFileSync(join(SHARED, "nearby-places.ts"), "utf8"),
      "export function isEnrichedListedRow",
    );
    expect(ring).toContain("isPlaceEnriched(");
    expect(ring).not.toContain("content_state");

    // The Discovery filter (Swipe, Catalog, Map's query) cuts on the stamp.
    const filters = readFileSync(join(SHARED, "discovery-filters.ts"), "utf8");
    expect(filters).toContain('q.not("enriched_at", "is", null)');
    expect(filters).not.toContain('q.eq("content_state", "ready")');
  });
});
