import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A place has six profile states (Pato, 2026-10-13), in one box. Enriching
// and Enriched are the enrichment states. Verified, Owned and Partnered no
// longer exist; nothing commercial is live. This pins the names so a step
// cannot sneak back into the states.

const here = __dirname;
const general = readFileSync(join(here, "StateCard.tsx"), "utf8");
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

  it("the place page has no enrichment step ladder", () => {
    const admin = readFileSync(join(here, "AdminSection.tsx"), "utf8");
    expect(admin).not.toContain("CrenupStateCard");
    expect(admin).not.toContain("Enrichment Steps");
    expect(admin).toContain("<StateCard");
    expect(admin).toContain("<ReviewsStateCard");
  });

  it("no retired state name is a row, a chip or a button", () => {
    for (const src of [general, reviews]) {
      for (const dead of ["Verified", "Owned", "Partnered", "Listed", "Unlist"]) {
        expect(src).not.toMatch(new RegExp(`(name|label)="${dead}`));
        expect(src).not.toContain(`>${dead}<`);
      }
    }
    expect(general).not.toContain('name="Active');
    expect(general).not.toContain("List on Mesita");
    expect(general).not.toContain("Mark inactive");
    expect(general).not.toContain("Mark active");
    expect(general).not.toContain("setPlaceActive");
    expect(general).toContain('"Disable" : "Enable"');
  });
});
