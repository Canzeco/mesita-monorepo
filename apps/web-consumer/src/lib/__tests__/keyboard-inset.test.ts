import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// THE KEYBOARD MUST SHRINK THE PAGE, not sit on top of it.
//
// MobileFrame is `h-dvh` and BottomNav is a flow child inside it, so every
// bottom-anchored thing in the shell — the tab bar, a sticky footer, the map's
// search chrome — measures from the LAYOUT viewport. On iOS Safari that
// viewport does not shrink when the keyboard opens; only the visual one does.
// Without a correction, those elements sit underneath the keyboard.
//
// This is a source-level guard on purpose: the behaviour needs a real
// visualViewport and a real soft keyboard, which jsdom has neither of. What it
// CAN prove is that the two halves of the fix are both still wired, which is
// what a well-meaning cleanup would break.

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("software keyboard never covers bottom-anchored chrome", () => {
  it("declares interactiveWidget so Android resizes the layout viewport", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("export const viewport");
    expect(layout).toContain('interactiveWidget: "resizes-content"');
  });

  it("keeps the Safari fallback wired into the frame, both breakpoints", () => {
    const frame = read("components/consumer/MobileFrame.tsx");
    expect(frame).toContain("useKeyboardInset");
    // --kb is the shared length. Mobile height, desktop min-height AND the
    // desktop card all subtract it; missing one leaves that breakpoint broken
    // while the others look fine.
    expect(frame).toContain('"--kb"');
    expect(frame).toContain("h-[calc(100dvh-var(--kb,0px))]");
    expect(frame).toContain("md:min-h-[calc(100dvh-var(--kb,0px))]");
    expect(frame).toContain("md:h-[calc(100dvh-2rem-var(--kb,0px))]");
  });

  it("ignores chrome-sized deltas so the iOS URL bar is not read as a keyboard", () => {
    const hook = read("lib/use-keyboard-inset.ts");
    expect(hook).toContain("KEYBOARD_MIN_PX");
    // offsetTop matters once the guest pans the visual viewport: the covered
    // strip is what is left below the visible box, not the raw height gap.
    expect(hook).toContain("window.innerHeight - vv.height - vv.offsetTop");
    expect(hook).toContain('vv.addEventListener("resize", read)');
    expect(hook).toContain('vv.addEventListener("scroll", read)');
    expect(hook).toContain('vv.removeEventListener("resize", read)');
    expect(hook).toContain('vv.removeEventListener("scroll", read)');
  });
});
