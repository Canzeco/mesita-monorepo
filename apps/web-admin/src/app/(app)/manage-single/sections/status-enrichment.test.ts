import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { intakeFunctionRows } from "./status-enrichment";

describe("intakeFunctionRows", () => {
  it("lists eleven functions 0–10 as called/not called", () => {
    const rows = intakeFunctionRows(
      {
        pulse: { status: "completed", at: null, detail: null },
        details: { status: "failed", at: null, detail: "no" },
        semantic: { status: "completed", at: null, detail: null },
      },
      true,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "seed",
      "pulse",
      "details",
      "serp",
      "links",
      "social",
      "images",
      "menu",
      "reviews",
      "description",
      "semantic",
    ]);
    expect(rows.map((r) => r.label)).toEqual([
      "0. Seed",
      "1. Pulse",
      "2. Details",
      "3. Serp",
      "4. Links",
      "5. Social",
      "6. Images",
      "7. Menu",
      "8. Reviews",
      "9. Description",
      "10. Semantic",
    ]);
    expect(rows[0]?.on).toBe(true);
    expect(rows[1]?.on).toBe(true);
    expect(rows[2]?.on).toBe(true);
    expect(rows[3]?.on).toBe(false);
    expect(rows[10]?.on).toBe(true);
  });
});

describe("Status + Intake boxes", () => {
  it("keeps Enriched a bool on Status; Intake is its own card", () => {
    const status = readFileSync(join(__dirname, "StatusCard.tsx"), "utf8");
    expect(status).toContain('name="Active (Google pulse)"');
    expect(status).toContain("setPlaceActive");
    expect(status).toContain("Mark inactive and unlist");
    expect(status).toContain('name="Enriching"');
    expect(status).toContain('name="Enriched"');
    expect(status).toContain("requestCountChip");
    expect(status).not.toContain("statusBoolChip(requested)");
    expect(status).not.toContain("intakeFunctionRows");
    expect(status).not.toContain("CreateStatusCard");
    expect(status).not.toContain("chipLabel={pulse === null");

    const intake = readFileSync(join(__dirname, "IntakeStatusCard.tsx"), "utf8");
    expect(intake).toContain("intakeFunctionRows");
    expect(intake).toContain('title="Intake"');
    expect(intake).not.toContain("CreateStatusCard");

    const admin = readFileSync(join(__dirname, "AdminSection.tsx"), "utf8");
    expect(admin).toContain("IntakeStatusCard");
    expect(admin).toContain("VerificationCard");
    expect(admin).not.toContain("IntakeStatusCards");
    expect(admin).not.toContain("CreateStatusCard");
    expect(admin).not.toContain("Ownership verified by");
  });
});

describe("Verification box", () => {
  it("owns ownership proof and wires the existing queue decide", () => {
    const card = readFileSync(join(__dirname, "VerificationCard.tsx"), "utf8");
    expect(card).toContain('title="Verification"');
    expect(card).toContain("listPlaceVerifications");
    expect(card).toContain("decidePlaceVerification");
    expect(card).toContain('href="/verifications"');
    expect(card).toContain("never lapses");
    expect(card).not.toContain(".from(");

    const admin = readFileSync(join(__dirname, "AdminSection.tsx"), "utf8");
    expect(admin).toContain("<VerificationCard");
    expect(admin).toContain("<MetaCard place={place} />");
    expect(admin).not.toContain("Ownership verified by");
  });
});
