import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const strip = readFileSync(join(__dirname, "SectionStrip.tsx"), "utf8");
const client = readFileSync(join(__dirname, "CrenupClient.tsx"), "utf8");

describe("Crenup section strip is wayfinding, not tabs", () => {
  it("starts hidden and actually disappears while Models is on screen", () => {
    expect(strip).toContain("useState(false)");
    expect(strip).toContain("opacity-0");
    expect(strip).toContain("pointer-events-none");
    expect(strip).toContain("aria-hidden={!shown}");
    expect(strip).toContain("inert={!shown}");
    expect(strip).toContain('closest("main")');
    expect(strip).toContain("s-models");
    expect(strip).toContain("s-create");
    expect(strip).toContain("s-enrich");
    expect(strip).toContain("s-functions");
    expect(strip).not.toContain("fixed inset-x-0 top-0");
  });

  it("hides by fading in place, never translating into the title margin", () => {
    // Tailwind v4 `translate-y-*` sets CSS `translate`, so a
    // `transition-[transform,opacity]` hide jumped into the PageHeader
    // margin then faded (MESITA-1791).
    expect(strip).toContain("transition-opacity");
    expect(strip).toContain('(shown ? "" : "pointer-events-none opacity-0")');
    const hideClass = strip.match(
      /shown \? "" : "([^"]+)"/,
    )?.[1];
    expect(hideClass).toBe("pointer-events-none opacity-0");
    expect(hideClass).not.toMatch(/translate/);
  });
});

describe("Crenup save bar leaves module space", () => {
  it("keeps pb-24 so Vote threshold can scroll clear of Save Crenup", () => {
    expect(client).toContain("pb-24");
    expect(client).not.toContain("gap-4 pb-4");
  });
});

describe("Crenup Models section is read-only reference", () => {
  it("links to Models and does not save model tiers from Crenup", () => {
    expect(client).toContain("Configure on Models ›");
    expect(client).toContain('href={MODELS_PARENT.href}');
    expect(client).toContain("Read-only reference — configure on Models.");
    expect(client).not.toContain("QualityPicker");
    expect(client).not.toContain("synthesisQuality: settings.synthesisQuality");
    expect(client).not.toContain("visionQuality: settings.visionQuality");
    expect(client).not.toContain("perplexityPreset: settings.perplexityPreset");
  });
});
