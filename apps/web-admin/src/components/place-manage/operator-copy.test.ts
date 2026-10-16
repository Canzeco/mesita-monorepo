import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const place = readFileSync(join(__dirname, "sections/PlaceSection.tsx"), "utf8");
const reviews = readFileSync(join(__dirname, "sections/ReviewsSummary.tsx"), "utf8");
const enrichment = readFileSync(join(__dirname, "sections/EnrichmentCard.tsx"), "utf8");
const writeBox = readFileSync(
  join(__dirname, "../../app/(app)/manage-multiple/WriteBox.tsx"),
  "utf8",
);

describe("operator copy", () => {
  it("names the profile card Links and lists every link kind", () => {
    expect(place).toContain('title="Links"');
    expect(place).not.toContain('title="Channels"');
    expect(place).not.toContain('label="Channels"');
    for (const label of [
      "Website",
      "Instagram",
      "Facebook",
      "WhatsApp",
      "Phone",
      "Google Maps",
      "Uber Eats",
      "OpenTable",
    ]) {
      expect(place).toContain(label);
    }
  });

  it("keeps Sync on Reviews and Enrichment on Admin", () => {
    expect(reviews).toContain('title="Reviews"');
    expect(reviews).not.toContain("Enrichment");
    expect(enrichment).toContain('title="Enrichment"');
    expect(enrichment).toContain("Run Enrichment");
    expect(enrichment).toContain("State:");
    expect(enrichment).toContain("Last run");
    expect(enrichment).toContain("Result:");
    expect(enrichment).toContain("useState(false)");
    expect(enrichment).toContain("setOverwrite(false)");
  });

  it("asks before a batch overwrite and then forgets the switch", () => {
    expect(writeBox).toContain("useState(false)");
    expect(writeBox).toContain("setOverwrite(false)");
    expect(writeBox).toContain("Overwrite existing data on");
    expect(writeBox).toContain("places and run");
  });
});
