import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A place has six profile states (Pato, 2026-10-13), in one box, and the
// Enrich pass of the ladder in another. Verified, Owned and Partnered no
// longer exist; nothing commercial is live. This pins the names and the
// split so a step cannot sneak back into the states.

const here = __dirname;
const general = readFileSync(join(here, "StateCard.tsx"), "utf8");
const enrichment = readFileSync(join(here, "CrenupStateCard.tsx"), "utf8");
const reviews = readFileSync(join(here, "ReviewsStateCard.tsx"), "utf8");

const rowNames = (src: string) =>
  [...src.matchAll(/<StateRow\s+name="([^"]+)"/g)].map((m) => m[1]);

describe("the six states of a place", () => {
  it("Profile States prints Created · Pulsing · Requested · Enriching · Enriched · Disabled", () => {
    expect(rowNames(general)).toEqual([
      "Created",
      "Pulsing",
      "Requested",
      "Enriching",
      "Enriched",
      "Disabled",
    ]);
    expect(general).toContain('title="Profile States"');
    expect(general).not.toContain("FunctionLadder");
    expect(general).not.toContain('title="General States"');
    expect(general).not.toContain('title="Creation"');
  });

  it("Reviews States reads the vocabulary, not a second copy of the names", () => {
    expect(reviews).toContain('title="Reviews States"');
    expect(reviews).toContain("REVIEW_STATE_FACTS.map");
    expect(reviews).toContain("name={fact.label}");
    expect(rowNames(reviews)).toEqual([]);
  });

  it("Enrichment Steps is the ladder, not three more states", () => {
    expect(rowNames(enrichment)).toEqual([]);
    expect(enrichment).toContain('title="Enrichment Steps"');
    expect(enrichment).toContain("enrichmentStepRows");
    expect(enrichment).not.toContain('title="Enrichment States"');
    expect(enrichment).not.toContain('title="Creation"');
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
