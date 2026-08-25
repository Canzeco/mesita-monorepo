import { describe, expect, it } from "vitest";

import type { PlaceEnrichmentStatus } from "./actions";
import { GENERAL_STATUS_FACTS } from "@/lib/status-vocabulary";
import {
  formatHeaderCategory,
  generalHeaderFacts,
  isEnrichFailed,
  isEnriching,
} from "./place-header-status";

function status(
  partial: Partial<PlaceEnrichmentStatus>,
): PlaceEnrichmentStatus {
  return {
    content_status: null,
    stage: null,
    stage_status: null,
    error: null,
    last_enriched_at: null,
    updated_at: null,
    serp_summary: null,
    ...partial,
  };
}

describe("isEnriching", () => {
  it("is true for every live pipeline stage, not just research", () => {
    expect(isEnriching(status({ stage: "research" }))).toBe(true);
    expect(isEnriching(status({ stage: "analysis" }))).toBe(true);
    expect(isEnriching(status({ stage: "contents" }))).toBe(true);
  });

  it("is true while contents is queued even if stage is stale", () => {
    expect(isEnriching(status({ content_status: "queued" }))).toBe(true);
    expect(isEnriching(status({ content_status: "generating" }))).toBe(true);
  });

  it("is false when idle or failed", () => {
    expect(isEnriching(null)).toBe(false);
    expect(isEnriching(status({ stage: "done" }))).toBe(false);
    expect(isEnriching(status({ stage: "failed" }))).toBe(false);
  });
});

describe("isEnrichFailed", () => {
  it("is only the failed stage", () => {
    expect(isEnrichFailed(status({ stage: "failed" }))).toBe(true);
    expect(isEnrichFailed(status({ stage: "research" }))).toBe(false);
    expect(isEnrichFailed(null)).toBe(false);
  });
});

describe("formatHeaderCategory", () => {
  it("keeps the catalog emoji and titleizes the name", () => {
    expect(formatHeaderCategory("🪩 Nightclub", null)).toEqual({
      emoji: "🪩",
      text: "Nightclub",
    });
  });

  it("titleizes a slug when the label is missing", () => {
    expect(formatHeaderCategory(null, "fine_dining")).toEqual({
      emoji: "",
      text: "Fine Dining",
    });
  });

  it("is null when both are empty", () => {
    expect(formatHeaderCategory(null, "")).toBeNull();
    expect(formatHeaderCategory(undefined, undefined)).toBeNull();
  });
});

describe("generalHeaderFacts", () => {
  const base = {
    partner: false,
    promoting: false,
    verified: false as boolean | "unknown",
  };

  it("labels match GENERAL_STATUS_FACTS", () => {
    const facts = generalHeaderFacts(base);
    expect(facts.map((f) => f.key)).toEqual(
      GENERAL_STATUS_FACTS.map((f) => f.key),
    );
    expect(facts.map((f) => f.label)).toEqual(
      GENERAL_STATUS_FACTS.map((f) => f.label),
    );
  });

  it("operational → Active on", () => {
    const facts = generalHeaderFacts({
      ...base,
      business_status: "OPERATIONAL",
    });
    expect(facts.find((f) => f.key === "active")?.on).toBe(true);
  });

  it("pulse 10/10 → Enriched on", () => {
    const facts = generalHeaderFacts({
      ...base,
      enrich_pulse: 10,
      enrich_pulse_total: 10,
    });
    expect(facts.find((f) => f.key === "enriched")?.on).toBe(true);
  });

  it("missing seeded → unknown", () => {
    const facts = generalHeaderFacts(base);
    expect(facts.find((f) => f.key === "seeded")?.on).toBe("unknown");
  });
});

