import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Feed's rails group into three bands by POSITION (MESITA-2308), so the
// rails' renaming (MESITA-2302) changes nothing here. Since MESITA-2355 every
// band is on the one card surface; hairlines alone divide them.
describe("the Feed's rails sit in three bands on one surface (MESITA-2308, MESITA-2355)", () => {
  const src = readFileSync(
    join(__dirname, "../../components/consumer/home/CatalogRails.tsx"),
    "utf8",
  );
  const bandA = src.indexOf('data-band="a"');
  const bandB = src.indexOf('data-band="b"');
  const bandC = src.indexOf('data-band="c"');

  it("puts every band on the one card surface, hairlines only (MESITA-2355)", () => {
    expect(src).toContain('<div data-band="a">');
    expect(src).toContain('className="border-border border-t" data-band="b"');
    expect(src).toContain(
      'className="border-border divide-border flex flex-col divide-y border-t border-b"',
    );
    expect(src).not.toMatch(/bg-muted\/\d+/);
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
    expect(src).toContain("scrollbar-hide flex min-w-0 flex-1 gap-1.5 overflow-x-auto");
  });

  it("pads the card row, not the rail, so the name column meets both hairlines (MESITA-2354)", () => {
    expect(src).toContain("overflow-x-auto overscroll-x-contain p-1.5");
    expect(src).not.toMatch(/data-band="[abc]"[^>]*py-/);
  });

  it("uses one 6px gap between cards and to every line (MESITA-2358)", () => {
    // gap-1.5 between cards and p-1.5 to the lines: the same 6px.
    expect(src).toContain("gap-1.5 overflow-x-auto overscroll-x-contain p-1.5");
    expect(src).toContain("gap-1.5 overflow-hidden p-1.5");
    expect(src).not.toContain("ml-3 flex");
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
