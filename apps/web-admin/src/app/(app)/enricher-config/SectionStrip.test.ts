import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const strip = readFileSync(join(__dirname, "SectionStrip.tsx"), "utf8");
const client = readFileSync(join(__dirname, "IntakeClient.tsx"), "utf8");

describe("Intake section strip is wayfinding, not tabs", () => {
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

  it("does not treat translate-y-full as enough to hide the bar", () => {
    // After the sticky+h-0 move, -translate-y-full alone parks the bar in
    // the PageHeader margin and it still reads as tabs (MESITA-1786).
    expect(strip).toMatch(/shown\s*\n\s*\? "translate-y-0"/);
    expect(strip).toContain('pointer-events-none -translate-y-full opacity-0');
  });
});

describe("Intake save bar leaves module space", () => {
  it("keeps pb-24 so Vote threshold can scroll clear of Save Intake", () => {
    expect(client).toContain("pb-24");
    expect(client).not.toContain("gap-4 pb-4");
  });
});
