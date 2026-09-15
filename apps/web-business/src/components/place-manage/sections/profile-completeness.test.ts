// A completeness chip must GO somewhere (MESITA-1883).
//
// THE BUG THIS EXISTS TO CATCH, and it shipped for a day with every check
// green. The Menu chip was `scrollId: "place-products"` — the id
// `MenusSection` renders. MESITA-1848 moved `MenusSection` to its own address,
// and from that moment the chip called `document.getElementById` on a page
// that no longer held the element, got null, and returned. A button that did
// nothing, with no error and no feedback, on the one card whose entire job is
// telling an operator what to go and fix.
//
// Nothing caught it. It typechecks (the id is a string), it lints, it renders,
// and no test asserted where a chip LANDS — only `products.test.ts` next door
// was in the habit of asserting destinations. The class of bug is "a
// same-page reference outliving the page", so the test has to be structural:
// derive which sections each place view renders, then prove every scroll
// target lives on the view that draws the card.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const SECTIONS = join(SRC, "components/place-manage/sections");
const VIEWS = join(SRC, "app/(shell)/places/[id]");

const read = (p: string) => readFileSync(p, "utf8");

/** view name → the section components its Tab renders, read off the Tab
 *  wrappers rather than hand-typed. A new view joins this map by existing. */
function sectionsByView(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const view of readdirSync(VIEWS, { withFileTypes: true })) {
    if (!view.isDirectory()) continue;
    const dir = join(VIEWS, view.name);
    const tabs = readdirSync(dir).filter((f) => /^[A-Z].*\.tsx$/.test(f));
    const names = new Set<string>();
    for (const t of tabs) {
      for (const m of read(join(dir, t)).matchAll(/sections\/([A-Za-z]+)/g)) {
        names.add(m[1]);
      }
    }
    if (names.size > 0) out[view.name] = [...names];
  }
  return out;
}

/** Every section file that renders `id="<target>"`. */
function filesRenderingId(target: string): string[] {
  return readdirSync(SECTIONS)
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => read(join(SECTIONS, f)).includes(`id="${target}"`))
    .map((f) => f.replace(/\.tsx$/, ""));
}

describe("ProfileCompleteness chips land somewhere real", () => {
  const card = read(join(SECTIONS, "ProfileCompleteness.tsx"));
  // Comments in this file NAME the old scrollId to explain why it left, so
  // every "is it gone" assertion has to read code, not prose.
  const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const scrollIds = [...code.matchAll(/scrollId:\s*"([^"]+)"/g)].map((m) => m[1]);

  it("every scrollId names an element that EXISTS", () => {
    for (const id of scrollIds) {
      expect(filesRenderingId(id), `scrollId "${id}" matches no rendered id`)
        .not.toHaveLength(0);
    }
  });

  it("every scrollId is rendered by the view that draws this card", () => {
    // The card lives on Profile, so a same-page scroll may only target a
    // section Profile itself renders. Targeting any other view's section is
    // the MESITA-1848 regression, and it is silent.
    const profileSections = sectionsByView().profile ?? [];
    expect(profileSections).toContain("ProfileCompleteness");

    for (const id of scrollIds) {
      for (const owner of filesRenderingId(id)) {
        expect(
          profileSections,
          `scrollId "${id}" lives in ${owner}, which Profile does not render — ` +
            `it must be a \`tab\` link instead of a scroll`,
        ).toContain(owner);
      }
    }
  });

  it("the Menu chip is a LINK, because Menus is its own view now", () => {
    // The specific regression, pinned: Menus has had its own address since
    // MESITA-1848, so this check must never go back to a scroll.
    const menu = code.slice(code.indexOf('label: "Menu"'));
    const entry = menu.slice(0, menu.indexOf("},"));
    expect(entry).toContain('tab: "menus"');
    expect(entry).not.toContain("scrollId");
    expect(sectionsByView().menus ?? []).toContain("MenusSection");
  });

  it("any check carrying a tab renders as a link, not just promos", () => {
    // Hardcoding `c.tab === "promos"` meant a second cross-view chip fell
    // through to the inert <span> and looked identical to a live one.
    expect(code).toContain("if (c.tab)");
    expect(code).not.toContain(String.raw`c.tab === "promos"`);
    expect(code).toContain("placeSectionHref(placeId, c.tab)");
  });
});
