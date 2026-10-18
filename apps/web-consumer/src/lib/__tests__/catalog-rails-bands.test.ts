import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pato (MESITA-2308): the Feed's rails sit in three subtly tinted bands with
// a hairline between them — by POSITION, so the rails' renaming
// (MESITA-2302) changes nothing here.
describe("the Feed's rails sit in three tinted bands (MESITA-2308)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );
  const bandA = src.indexOf('data-band="a"');
  const bandB = src.indexOf('data-band="b"');
  const bandC = src.indexOf('data-band="c"');

  it("tints the first rail deepest, the second lighter, the rest on the card", () => {
    expect(src).toContain('className="bg-muted/50" data-band="a"');
    expect(src).toContain('className="bg-muted/25 border-border border-t" data-band="b"');
    expect(src).toContain(
      'className="bg-card border-border divide-border flex flex-col divide-y border-t"',
    );
    expect(bandA).toBeGreaterThan(0);
    expect(bandB).toBeGreaterThan(bandA);
    expect(bandC).toBeGreaterThan(bandB);
  });

  it("groups by position: the first rail, the second, every rail after", () => {
    expect(src).toContain("const [firstRail, secondRail, ...restRails] = shownRails;");
    expect(src).toContain("{firstRail ? renderRail(firstRail) : null}");
    expect(src).toContain("{restRails.map((rail) => (");
  });

  it("draws no places count above the rails (MESITA-2354)", () => {
    expect(src).not.toContain("summary.total");
    expect(src).not.toContain("summarizeCatalog");
  });

  it("draws a hairline above every family rail too (MESITA-2353)", () => {
    const c = src.slice(bandC);
    expect(c).toContain("<div key={rail.key}>");
    expect(c).toContain("{renderRail(rail)}");
  });

  it("keeps the cards a little closer together (MESITA-2353)", () => {
    expect(src).toContain("scrollbar-hide ml-3 flex min-w-0 flex-1 gap-1.5 overflow-x-auto");
  });

  it("pads the card row, not the rail, so the name column meets both hairlines (MESITA-2354)", () => {
    expect(src).toContain("overflow-x-auto overscroll-x-contain py-3");
    expect(src).not.toMatch(/data-band="[abc]"[^>]*py-3/);
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
