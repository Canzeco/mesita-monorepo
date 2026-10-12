import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A place has six states (Pato, 2026-10-11), in two boxes. Verified, Owned and
// Partnered no longer exist; nothing commercial is live. This pins the names
// and the grouping so neither box can quietly grow a seventh row or keep an
// old label.

const here = __dirname;
const general = readFileSync(join(here, "StateCard.tsx"), "utf8");
const enrichment = readFileSync(join(here, "CrenupStateCard.tsx"), "utf8");

const rowNames = (src: string) =>
  [...src.matchAll(/<StateRow\s+name="([^"]+)"/g)].map((m) => m[1]);

describe("the six states of a place", () => {
  it("General States prints Created · Pulsing · Disabled", () => {
    expect(rowNames(general)).toEqual(["Created", "Pulsing", "Disabled"]);
  });

  it("Enrichment States prints Requested · Enriching · Enriched", () => {
    expect(rowNames(enrichment)).toEqual(["Requested", "Enriching", "Enriched"]);
  });

  it("no retired state name is a row, a chip or a button", () => {
    for (const src of [general, enrichment]) {
      for (const dead of ["Verified", "Owned", "Partnered", "Listed", "Unlist"]) {
        expect(src).not.toMatch(new RegExp(`(name|label)="${dead}`));
        expect(src).not.toContain(`>${dead}<`);
      }
    }
    expect(general).not.toContain('name="Active');
    expect(general).not.toContain("List on Mesita");
    expect(general).toContain('"Disable" : "Enable"');
  });
});
