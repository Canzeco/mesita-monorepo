import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(join(here, "AppShell.tsx"), "utf8");

// The frame is the one box every admin page sits in, and the two ways it can
// break are both invisible until an operator hits them: it can disagree with
// the window (a measured height that went stale), or it can SCROLL ITSELF
// (an overflow:hidden box is still a scroll container, so a find-in-page hit
// or an autoFocus under a subtree that overflows drags rail and content up
// together and leaves dead space below — with no scrollbar to come back).
describe("the admin frame is pinned to the viewport and never scrolls", () => {
  it("is fixed inset-0, not a measured dvh box", () => {
    expect(shell).toContain('"fixed inset-0 flex overflow-clip"');
    expect(shell).not.toContain("h-dvh");
  });

  it("clips rather than hides, so the frame is not a scroll container", () => {
    // Comments stripped first — the prose above the frame names the class it
    // bans, and a raw scan would read that as the class still being there.
    const code = shell
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("overflow-hidden");
  });

  it("lets the main column shrink, so it can never outgrow the frame", () => {
    expect(shell).toContain('"flex min-w-0 min-h-0 flex-1 flex-col"');
  });

  it("keeps main as the only scroller", () => {
    expect(shell).toContain('<main className="flex-1 overflow-x-hidden overflow-y-auto">');
  });
});
