// Favorites is the bookmark list, not a second discovery surface (MESITA-1327).
// The "More like your saves" rail ranked unsaved deck places by category/zone
// overlap and rendered empty-heart suggestion tiles. Pato's live screenshot
// killed that: this tab shows only saved places. This file reads the source as
// text and pins it.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FORBIDDEN = [
  "More like your saves",
  "Suggested places",
  "saveSuggestion",
  "saved={false}",
];

describe("Favorites is saved places only", () => {
  const web = read(
    "apps/web-consumer/src/components/consumer/home/FavoritesList.tsx",
  );

  it.each(FORBIDDEN)("the surface does not contain %s", (needle) => {
    expect(web).not.toContain(needle);
  });

  it("web still names the saved grid", () => {
    expect(web).toContain('aria-label="Saved places"');
    expect(web).toContain("{savedIds.size} saved");
  });
});
