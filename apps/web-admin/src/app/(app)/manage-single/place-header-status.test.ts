import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { PlaceEnrichmentStatus } from "./actions";
import { GENERAL_STATUS_FACTS } from "@/lib/status-vocabulary";
import {
  generalHeaderFacts,
  isEnrichFailed,
  isEnriching,
  listedFromStatus,
  withListedFromStatus,
} from "./place-header-status";
import { requestCountFromRow } from "@/lib/status-vocabulary";

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

  it("Enriching is the live run and can stay true while Enriched is true", () => {
    const facts = generalHeaderFacts({
      ...base,
      enriching: true,
      enrich_pulse: 10,
      enrich_pulse_total: 10,
    });
    expect(facts.find((f) => f.key === "enriching")?.on).toBe(true);
    expect(facts.find((f) => f.key === "enriching")?.chip).toBe("true");
    expect(facts.find((f) => f.key === "enriched")?.on).toBe(true);
  });

  it("missing enriching → unknown, not a false no", () => {
    const facts = generalHeaderFacts(base);
    expect(facts.find((f) => f.key === "enriching")?.on).toBe("unknown");
    expect(facts.find((f) => f.key === "enriching")?.chip).toBe("?");
  });

  it("missing seeded → unknown", () => {
    const facts = generalHeaderFacts(base);
    expect(facts.find((f) => f.key === "seeded")?.on).toBe("unknown");
  });

  it("header facts keep Status-box chip encoding; Requested is n; Visit Rewards is 0 | 1 | 2", () => {
    const off = generalHeaderFacts(base);
    expect(off.find((f) => f.key === "partner")?.label).toBe("Partnered");
    expect(off.find((f) => f.key === "partner")?.chip).toBe("false");
    expect(off.find((f) => f.key === "requested")?.chip).toBe("?");
    expect(off.find((f) => f.key === "promoting")?.label).toBe("Visit Rewards");
    expect(off.find((f) => f.key === "promoting")?.chip).toBe("0");
    const on = generalHeaderFacts({
      ...base,
      requestCount: 3,
      partner: true,
      promotingLevel: 1,
      verified: true,
    });
    expect(on.find((f) => f.key === "requested")?.chip).toBe("3");
    expect(on.find((f) => f.key === "requested")?.on).toBe(true);
    expect(on.find((f) => f.key === "partner")?.chip).toBe("true");
    expect(on.find((f) => f.key === "verified")?.chip).toBe("true");
    expect(on.find((f) => f.key === "promoting")?.chip).toBe("1");
    expect(on.find((f) => f.key === "promoting")?.on).toBe(true);
    const zero = generalHeaderFacts({ ...base, requestCount: 0 });
    expect(zero.find((f) => f.key === "requested")?.chip).toBe("0");
    expect(zero.find((f) => f.key === "requested")?.on).toBe(false);
    const dominant = generalHeaderFacts({ ...base, promotingLevel: 3 });
    expect(dominant.find((f) => f.key === "promoting")?.chip).toBe("2");
  });

  it("header display names stay Created … Mesita Credits, never true/false/0", () => {
    const facts = generalHeaderFacts({
      ...base,
      seeded: true,
      listed: true,
      enrich_pulse: 10,
      enrich_pulse_total: 10,
      verified: false,
      partner: true,
      promotingLevel: 2,
    });
    expect(facts.map((f) => f.label)).toEqual([
      "Created",
      "Active",
      "Listed",
      "Requested",
      "Enriched",
      "Enriching",
      "Verified",
      "Partnered",
      "Visit Rewards",
      "Mesita Pay",
      "Mesita Credits",
    ]);
    expect(facts.every((f) => !/^(true|false|[012])$/.test(f.label))).toBe(true);
  });

  it("acceptance bits: absent input is unknown ('?'), booleans pass through", () => {
    const absent = generalHeaderFacts(base);
    expect(absent.find((f) => f.key === "mesita_pay")?.on).toBe("unknown");
    expect(absent.find((f) => f.key === "mesita_pay")?.chip).toBe("?");
    expect(absent.find((f) => f.key === "credits")?.chip).toBe("?");
    const set = generalHeaderFacts({ ...base, mesitaPay: false, credits: true });
    expect(set.find((f) => f.key === "mesita_pay")?.on).toBe(false);
    expect(set.find((f) => f.key === "mesita_pay")?.chip).toBe("false");
    expect(set.find((f) => f.key === "credits")?.on).toBe(true);
    expect(set.find((f) => f.key === "credits")?.chip).toBe("true");
  });
});

describe("requestCountFromRow", () => {
  it("is the guest request count, including after Enriched", () => {
    expect(requestCountFromRow(1)).toBe(1);
    expect(requestCountFromRow(2)).toBe(2);
    expect(requestCountFromRow(0)).toBe(0);
    expect(requestCountFromRow(7)).toBe(7);
    expect(requestCountFromRow(null)).toBe("unknown");
    expect(requestCountFromRow(undefined)).toBe("unknown");
  });
});

describe("listedFromStatus", () => {
  it("active and lead are listed; paused is not", () => {
    expect(listedFromStatus("active")).toBe(true);
    expect(listedFromStatus("lead")).toBe(true);
    expect(listedFromStatus("paused")).toBe(false);
    expect(listedFromStatus("archived")).toBe(false);
    expect(listedFromStatus(null)).toBe("unknown");
  });

  it("withListedFromStatus overwrites a stale listed flag after Unlist", () => {
    const merged = withListedFromStatus({
      status: "paused",
      listed: true,
    });
    expect(merged.listed).toBe(false);
    expect(withListedFromStatus({ status: "active", listed: false }).listed).toBe(
      true,
    );
  });
});

describe("the header is name + statuses, nothing else", () => {
  const chrome = readFileSync(
    join(process.cwd(), "src/app/(app)/manage-single/PlaceEditChrome.tsx"),
    "utf8",
  );

  it("prints no category in the identity line", () => {
    // An unset category rendered "❓ Undefined" beside the real facts:
    // a placeholder wearing their weight. Category is an editable field
    // and belongs on Profile (Pato, 2026-08-29).
    expect(chrome).not.toContain("formatHeaderCategory");
    expect(chrome).not.toContain("category.emoji");
    expect(chrome).not.toContain("place.category");
    expect(chrome).toContain("placeDisplayName(place)");
  });
});
