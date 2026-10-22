// MVP test rule (MESITA-2600): only the no-mock guard stays; UI pins were removed (MESITA-2601).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(__dirname, "..", "..", rel), "utf8");
}

// NO MOCK DATA ANYWHERE IN DISCOVERY (Pato, live, 2026-09-08: "don't put
// shitty mock data"). `lib/mock/feed-places.ts` is deleted, not parked — it
// was the last caller's only consumer, and a plausible-looking place you
// cannot visit teaches a reviewer nothing while quietly becoming the thing
// everyone demos. MESITA-2105 brought a sample deck back for one day;
// MESITA-2095 deleted it with `lib/mock/` once Pato began creating real
// places, and this pin is absolute again. Social has no data and says so
// rather than painting sample people.
describe("Discovery invents no places", () => {
  it.each([
    ["Places", "components/consumer/home/CatalogRails.tsx"],
    ["the place lookup", "lib/api/places.ts"],
  ])("%s ships no mock deck", (_label, rel) => {
    const src = read(rel);
    expect(src).not.toContain("FEED_MOCK_PLACES");
    expect(src).not.toContain("mock/feed-places");
    expect(src).not.toContain("lib/mock/");
    expect(src).not.toMatch(
      /SCROLL_USES_MOCK|scrollMockPlaces|isMockPlace|mockPlaceDetail/,
    );
    expect(src).not.toMatch(/["'`]mock-/);
  });
});
