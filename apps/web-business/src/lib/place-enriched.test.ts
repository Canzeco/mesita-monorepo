import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enrichmentView, isEnrichedPlace } from "./place-enriched";
import {
  crenupMeterLine,
  enrichmentStepRows,
} from "@/components/place-manage/sections/state-enrichment";

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

describe("crenupMeterLine — the completeness meter, never the yes/no", () => {
  it("prints N of total and where a Created place stopped", () => {
    expect(
      crenupMeterLine({
        enrich_crenup: 1,
        enrich_crenup_total: 8,
        enrich_crenup_labels: ["Seed", "Details", "Serp"],
        enrich_crenup_blocked: { key: "serp", index: 2, state: "missing" },
      }),
    ).toBe("1 of 8, stopped at Serp (missing).");
  });

  it("drops the stop reason once the queue finished, and the line on an older payload", () => {
    expect(crenupMeterLine({ enrich_crenup: 8, enrich_crenup_total: 8, enrich_crenup_blocked: null })).toBe(
      "8 of 8.",
    );
    expect(crenupMeterLine({})).toBeNull();
  });
});

describe("enrichmentStepRows — the Enrich pass, Seed left off", () => {
  it("names 1–8 with the Enriched suffix and skips Seed", () => {
    const rows = enrichmentStepRows(
      {
        details: { state: "completed", at: null, detail: null },
        serp: { state: "failed", at: null, detail: null },
      },
      true,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "1. Details Enriched",
      "2. Serp Enriched",
      "3. Links Enriched",
      "4. Social Enriched",
      "5. Reviews Enriched",
      "6. Images Enriched",
      "7. Description Enriched",
      "8. Vectors Enriched",
    ]);
    expect(rows.map((row) => row.key)).not.toContain("seed");
    expect(rows.find((row) => row.key === "details")?.on).toBe(true);
    expect(rows.find((row) => row.key === "serp")?.failed).toBe(true);
    expect(rows.find((row) => row.key === "links")?.on).toBe(false);
  });
});
