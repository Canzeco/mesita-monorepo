// THE GRAMMAR IS A GATE NOW, NOT A CONVENTION (MESITA-2034, D17).
//
// Eleven files converted to Group/Rule in one PR is eleven chances for the
// NEXT edit to slip a `Section` or a `Tiles` back into a Setup half because
// it was the fastest way to add one more row. The compiler cannot catch
// that — `Section` and `Group` both typecheck fine wherever either is
// legal — so this reads the source text the way a reviewer would.
//
// SLICED TO THE MANAGE HALF, NOT THE WHOLE FILE. Every one of these files
// also owns an Activity half, and Activity is explicitly OUT of scope
// (D14) — LineView's Activity half still renders `Section`, `Tiles` and
// `TINY_LABEL_CLASS` on purpose, because it is the confirmed-live caller
// `Rule`'s legacy `value` prop exists to keep working. A whole-file scan
// would fail on every one of those and teach the next person to silence
// the test rather than trust it.
//
// A FILE WITH NO `<Half>` AT ALL (MenuView, PartnerPane) has no Activity
// half to exclude — the whole file IS the Setup grammar — so the slice is
// the whole source.
//
// THE EMPTY-SLICE CHECK CLOSES THE SILENT-PASS FAILURE MODE. A banned
// pattern that never appears because the slice itself came out empty (a
// renamed `Half`, a moved boundary) reads as "clean" to every assertion
// below it. Asserting the slice is non-trivial catches that before the
// bug does.
//
// PROFILEVIEW.TSX IS DELIBERATELY ABSENT. Its masonry-to-Group conversion
// is T8, its own follow-up issue — adding it here before that PR lands
// would fail on code nobody has touched yet for this one. T8 adds it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VIEWS = join(__dirname, "..", "components", "views");
const CONSOLE = join(__dirname, "..", "components", "console");

const IN_SCOPE = [
  join(VIEWS, "ReviewsView.tsx"),
  join(VIEWS, "VisitsView.tsx"),
  join(VIEWS, "ReservationsView.tsx"),
  join(VIEWS, "WebsiteView.tsx"),
  join(CONSOLE, "PartnerPane.tsx"),
  join(VIEWS, "OrdersView.tsx"),
  join(VIEWS, "LineView.tsx"),
  join(VIEWS, "MenuView.tsx"),
  join(VIEWS, "CreditsView.tsx"),
  join(VIEWS, "PayView.tsx"),
  join(VIEWS, "RewardsView.tsx"),
  join(VIEWS, "DevelopersView.tsx"),
];

/** The Setup slice: from `<Half label="Manage">` to whichever comes next —
 *  the file's `<Half label="Activity">` or, for a file with no Activity
 *  half at all, the end of the source. A file with no `<Half>` whatsoever
 *  (MenuView, PartnerPane) has nothing to exclude, so the slice is the
 *  whole file. */
function setupSlice(src: string): string {
  const manageIdx = src.indexOf('<Half label="Manage">');
  if (manageIdx === -1) return src;
  const activityIdx = src.indexOf('<Half label="Activity">', manageIdx);
  return activityIdx === -1 ? src.slice(manageIdx) : src.slice(manageIdx, activityIdx);
}

/** The prop text of one self-closing JSX tag (`<Table ... />`), tracking
 *  brace depth so a `>` or `/>` nested inside a prop value — `empty={
 *  <EmptyState .../> }` — never passes for the tag's own close. Every
 *  `<Table` in this codebase is self-closing; a `<Table>...</Table>` form
 *  would need a different scan and is a deliberate non-goal here. */
function selfClosingTagProps(src: string, tagStart: number): string {
  let i = tagStart + 1;
  let depth = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (depth === 0 && ch === "/" && src[i + 1] === ">") return src.slice(tagStart, i);
    i++;
  }
  throw new Error(`Unterminated tag from index ${tagStart}`);
}

const BANNED: [name: string, pattern: RegExp][] = [
  ["<Section", /<Section\b/],
  ["SoonStrip", /\bSoonStrip\b/],
  ["<Tiles", /<Tiles\b/],
  ["INFO_BOX_CLASS", /\bINFO_BOX_CLASS\b/],
  ["TINY_LABEL_CLASS", /\bTINY_LABEL_CLASS\b/],
  ["lane", /\blane\b/],
  ["CTA_BUTTON_CLASS", /\bCTA_BUTTON_CLASS\b/],
];

describe("every Setup half keeps the Group/Rule grammar", () => {
  it.each(IN_SCOPE)("%s", (path) => {
    const src = readFileSync(path, "utf8");
    const slice = setupSlice(src);

    // Closes the silent-pass mode: every assertion below is vacuously true
    // against an empty string.
    expect(slice.trim().length, `${path}: the Setup slice came out empty`).toBeGreaterThan(0);

    for (const [name, pattern] of BANNED) {
      expect(pattern.test(slice), `${path}: found banned "${name}" in its Setup half`).toBe(false);
    }

    let tableIdx = slice.indexOf("<Table");
    while (tableIdx !== -1) {
      const props = selfClosingTagProps(slice, tableIdx);
      expect(/\binCard\b/.test(props), `${path}: a <Table> in Setup is missing inCard`).toBe(true);
      tableIdx = slice.indexOf("<Table", tableIdx + 1);
    }
  });
});
