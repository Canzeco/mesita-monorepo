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
    expect(src).toContain('className="bg-muted/50 pb-3" data-band="a"');
    expect(src).toContain('className="bg-muted/25 border-border border-t py-3" data-band="b"');
    expect(src).toContain('className="bg-card border-border flex flex-col gap-4 border-t py-3 pb-4"');
    expect(bandA).toBeGreaterThan(0);
    expect(bandB).toBeGreaterThan(bandA);
    expect(bandC).toBeGreaterThan(bandB);
  });

  it("groups by position: the first rail, the second, every rail after", () => {
    expect(src).toContain("const [firstRail, secondRail, ...restRails] = shownRails;");
    expect(src).toContain("{firstRail ? renderRail(firstRail) : null}");
    expect(src).toContain("{restRails.map(renderRail)}");
  });

  it("the places count sits on band A's tint, above the first rail", () => {
    const count = src.indexOf("{summary.total} {summary.total === 1");
    expect(count).toBeGreaterThan(bandA);
    expect(count).toBeLessThan(src.indexOf("renderRail(firstRail)"));
  });

  it("uses semantic tokens only", () => {
    expect(src).not.toMatch(/bg-(zinc|gray|neutral|white)/);
  });
});
