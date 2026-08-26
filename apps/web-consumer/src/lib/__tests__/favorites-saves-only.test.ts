// Favorites is the bookmark list, not a second discovery surface (MESITA-1327).
// The "More like your saves" rail ranked unsaved deck places by category/zone
// overlap and rendered empty-heart suggestion tiles. Pato's live screenshot
// killed that: this tab shows only saved places. mobile-consumer has no test
// runner, so this file reads both sources the same way ticket-status-drift does.

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

describe("Favorites is saved places only (web ↔ mobile)", () => {
  const web = read(
    "apps/web-consumer/src/components/consumer/home/FavoritesList.tsx",
  );
  const mobile = read(
    "apps/mobile-consumer/src/components/home/FavoritesTab.tsx",
  );

  it.each(FORBIDDEN)("neither surface contains %s", (needle) => {
    expect(web).not.toContain(needle);
    expect(mobile).not.toContain(needle);
  });

  it("web still names the saved grid", () => {
    expect(web).toContain('aria-label="Saved places"');
    expect(web).toContain("{savedIds.size} saved");
  });

  it("mobile still names the saved count", () => {
    expect(mobile).toContain("{savedIds.size} saved");
  });
});
