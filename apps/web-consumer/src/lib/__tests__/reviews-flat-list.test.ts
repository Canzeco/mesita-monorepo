import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PKG = join(
  __dirname,
  "../../../../../packages/place-profile/src/components",
);
const read = (rel: string) => readFileSync(join(PKG, rel), "utf8");

// MESITA-2309 (Pato): reviews read like Google Maps — one flat list, a
// hairline between reviews, no box, no "Google reviews" title.
describe("the Reviews tab is one flat list", () => {
  it("has no box or title, and lines divide the reviews", () => {
    const list = read("place-detail/reviews.tsx");
    expect(list).not.toContain("<Box");
    expect(list).not.toContain('title="Google reviews"');
    expect(list).toContain("divide-y");
  });

  it("draws each review without its own tile", () => {
    const card = read("ReviewCard.tsx");
    expect(card).not.toContain("rounded-2xl p-4");
    expect(card).not.toContain("bg-background");
  });

  it("sorts with plain words, not a grey segmented track", () => {
    const sort = read("place-detail/review-ui.tsx");
    expect(sort).not.toContain("bg-muted/60");
    expect(sort).toContain("bg-foreground text-paper");
  });
});
