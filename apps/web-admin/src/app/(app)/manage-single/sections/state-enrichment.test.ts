import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { intakeFunctionRows } from "./state-enrichment";

describe("intakeFunctionRows", () => {
  it("lists eleven functions 0–10 as called/not called", () => {
    const rows = intakeFunctionRows(
      {
        pulse: { state: "completed", at: null, detail: null },
        details: { state: "failed", at: null, detail: "no" },
        embedding: { state: "completed", at: null, detail: null },
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
      { semantic: { state: "completed", at: null, detail: null } },
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

describe("Three state boxes", () => {
  // Pato, 2026-08-30: one eleven-row wall became three boxes, each with a
  // single job. General and Partnership render from StateCard.tsx; the two
  // Intake facts moved to the Intake box with the read that feeds them.
  it("splits General · Partnership · Intake, each owning its own facts", () => {
    const card = readFileSync(join(__dirname, "StateCard.tsx"), "utf8");
    expect(card).toContain('title="General States"');
    expect(card).toContain('title="Partnership States"');
    expect(card).not.toContain('title="State"');
    // General owns the reachability facts and both operator writes.
    expect(card).toContain('name="Active (Google pulse)"');
    expect(card).toContain("setPlaceActive");
    expect(card).toContain("Mark inactive and unlist");
    expect(card).toContain('name="Verified"');
    expect(card).toContain("requestCountChip");
    expect(card).not.toContain("stateBoolChip(requested)");
    // Partnership owns the commercial facts and the drift warning.
    expect(card).toContain('name="Partnered"');
    expect(card).toContain('name="Visit Rewards"');
    expect(card).toContain('name="Mesita Pay"');
    expect(card).toContain('name="Mesita Credits"');
    expect(card).toContain("Guest surfaces disagree with Visit Rewards");
    // The Intake facts and their read LEFT this file — moved, not copied, so
    // the Admin tab still issues exactly one getPlaceEnrichment call.
    expect(card).not.toContain('name="Enriching"');
    expect(card).not.toContain('name="Enriched"');
    expect(card).not.toContain("getPlaceEnrichment");
    expect(card).not.toContain("intakeFunctionRows");
    expect(card).not.toContain("CreateStateCard");
    expect(card).not.toContain("chipLabel={pulse === null");

    const intake = readFileSync(join(__dirname, "IntakeStateCard.tsx"), "utf8");
    expect(intake).toContain("intakeFunctionRows");
    expect(intake).toContain('title="Intake States"');
    expect(intake).toContain('name="Enriched"');
    expect(intake).toContain('name="Enriching"');
    expect(intake).toContain("getPlaceEnrichment");
    expect(intake).not.toContain("CreateStateCard");

    const admin = readFileSync(join(__dirname, "AdminSection.tsx"), "utf8");
    expect(admin).toContain("IntakeStateCard");
    expect(admin).toContain("VerificationCard");
    expect(admin).not.toContain("IntakeStateCards");
    expect(admin).not.toContain("CreateStateCard");
    expect(admin).not.toContain("Ownership verified by");
  });

  // MESITA-1541/1542: the house word is State — in schema, payloads and
  // prose alike. `status` survives only where it names a payload we did not
  // author (HTTP codes, vendor fields).
  // The BOX never says it again — not in a title, not in prose.
  it("never says Statuses", () => {
    for (const file of ["StateCard.tsx", "IntakeStateCard.tsx", "AdminSection.tsx"]) {
      expect(readFileSync(join(__dirname, file), "utf8")).not.toContain("Statuses");
    }
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
