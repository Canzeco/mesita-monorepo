// MVP test rule (MESITA-2600): only the data guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const enrichment = readFileSync(join(__dirname, "sections/EnrichmentCard.tsx"), "utf8");
const writeBox = readFileSync(
  join(__dirname, "../../app/(app)/manage-multiple/WriteBox.tsx"),
  "utf8",
);

describe("operator copy", () => {
  it("Enrichment's overwrite switch defaults off and resets", () => {
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
