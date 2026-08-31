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
        embedding: { status: "completed", at: null, detail: null },
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
      "embedding",
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
      "10. Embedding",
    ]);
    expect(rows[0]?.on).toBe(true);
    expect(rows[1]?.on).toBe(true);
    expect(rows[2]?.on).toBe(true);
    expect(rows[3]?.on).toBe(false);
    expect(rows[10]?.on).toBe(true);
  });

  it("folds a legacy `semantic` stamp into 10. Embedding", () => {
    const rows = intakeFunctionRows(
      { semantic: { status: "completed", at: null, detail: null } },
      false,
    );
    expect(rows[10]).toMatchObject({
      key: "embedding",
      label: "10. Embedding",
      on: true,
    });
    expect(rows.filter((r) => r.on)).toHaveLength(1);
  });
});

describe("Three status boxes", () => {
  // Pato, 2026-08-30: one eleven-row wall became three boxes, each with a
  // single job. General and Partnership render from StatusCard.tsx; the two
  // Intake facts moved to the Intake box with the read that feeds them.
  it("splits General · Partnership · Intake, each owning its own facts", () => {
    const status = readFileSync(join(__dirname, "StatusCard.tsx"), "utf8");
    expect(status).toContain('title="General Statuses"');
    expect(status).toContain('title="Partnership Statuses"');
    expect(status).not.toContain('title="Status"');
    // General owns the reachability facts and both operator writes.
    expect(status).toContain('name="Active (Google pulse)"');
    expect(status).toContain("setPlaceActive");
    expect(status).toContain("Mark inactive and unlist");
    expect(status).toContain('name="Verified"');
    expect(status).toContain("requestCountChip");
    expect(status).not.toContain("statusBoolChip(requested)");
    // Partnership owns the commercial facts and the drift warning.
    expect(status).toContain('name="Partnered"');
    expect(status).toContain('name="Visit Rewards"');
    expect(status).toContain('name="Mesita Pay"');
    expect(status).toContain('name="Mesita Credits"');
    expect(status).toContain("Guest surfaces disagree with Visit Rewards");
    // The Intake facts and their read LEFT this file — moved, not copied, so
    // the Admin tab still issues exactly one getPlaceEnrichment call.
    expect(status).not.toContain('name="Enriching"');
    expect(status).not.toContain('name="Enriched"');
    expect(status).not.toContain("getPlaceEnrichment");
    expect(status).not.toContain("intakeFunctionRows");
    expect(status).not.toContain("CreateStatusCard");
    expect(status).not.toContain("chipLabel={pulse === null");

    const intake = readFileSync(join(__dirname, "IntakeStatusCard.tsx"), "utf8");
    expect(intake).toContain("intakeFunctionRows");
    expect(intake).toContain('title="Intake Statuses"');
    expect(intake).toContain('name="Enriched"');
    expect(intake).toContain('name="Enriching"');
    expect(intake).toContain("getPlaceEnrichment");
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
