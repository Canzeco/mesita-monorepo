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
    expect(isEnrichedPlace({ enriched_at: "  " })).toBe(false);
    expect(isEnrichedPlace({})).toBe(false);
  });

  it("reads enriched_at set as enriched", () => {
    expect(isEnrichedPlace({ enriched_at: "2026-10-01T00:00:00Z" })).toBe(true);
    expect(isEnrichedPlace({ enriched: true })).toBe(true);
  });

  it("lets the server's boolean win over the column", () => {
    expect(
      isEnrichedPlace({ enriched: false, enriched_at: "2026-10-01T00:00:00Z" }),
    ).toBe(false);
  });

  it("states the server's one rule: every server reader goes through isPlaceEnriched", () => {
    const state = readFileSync(join(SHARED, "place-state.ts"), "utf8");
    const rule = fnBody(state, "export function isPlaceEnriched");
    expect(rule).toContain("enrichedAt");
    expect(rule).not.toContain("content_state");

    // The consumer wire `enriched` delegates to it.
    const wire = fnBody(
      readFileSync(join(SHARED, "place-family-keys.ts"), "utf8"),
      "export function isEnrichedPlace",
    );
    expect(wire).toContain("isPlaceEnriched(");
    expect(wire).not.toContain("content_state");

    // Mesita Selected is NOT enrichment (MESITA-2707): the Selected pool
    // (Chat) cuts on the operator's mark in SQL and never on the stamp.
    const pool = fnBody(
      readFileSync(join(SHARED, "area-pipeline.ts"), "utf8"),
      "export function selectedPoolQuery",
    );
    expect(pool).toContain('.eq("selected", true)');
    expect(pool).not.toContain("enriched_at");
  });
});
