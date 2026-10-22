// MVP test rule (MESITA-2600): only the data guard stays; UI pins were removed (MESITA-2601).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const client = readFileSync(join(__dirname, "CrenupClient.tsx"), "utf8");

describe("Creation's Models section is a link, not a copy (MESITA-2126)", () => {
  it("links to Models and neither shows nor saves model tiers", () => {
    expect(client).toContain("Which AI model each step uses is set on");
    expect(client).toContain('href={MODELS_PARENT.href}');
    expect(client).not.toContain("QUALITY_LABEL");
    expect(client).not.toContain("QualityPicker");
    expect(client).not.toContain("synthesisQuality: settings.synthesisQuality");
    expect(client).not.toContain("visionQuality: settings.visionQuality");
    expect(client).not.toContain("perplexityPreset: settings.perplexityPreset");
  });
});
