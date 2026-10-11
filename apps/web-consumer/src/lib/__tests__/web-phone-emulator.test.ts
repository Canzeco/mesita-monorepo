import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// /web IS THE PHONE EMULATOR (Pato, MESITA-2134: "make it kinda like a mobile
// emulator in web — fuck the sidebar menu").
//
// Both surfaces draw MobileFrame's phone card, and BottomNav is the only menu
// at every width. Source-level on purpose: jsdom renders no width, so a
// breakpoint class that hides the menu would pass every render test.

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("/web is the phone emulator", () => {
  const shell = read("app/(shell)/layout.tsx");

  it("the sidebar frame is gone", () => {
    expect(existsSync(join(SRC, "components/consumer/WebFrame.tsx"))).toBe(
      false,
    );
    expect(shell).not.toContain("WebFrame");
  });

  it("the shell draws the phone card with the bottom menu", () => {
    expect([...shell.matchAll(/<MobileFrame>/g)]).toHaveLength(1);
    expect([...shell.matchAll(/<BottomNav\b/g)]).toHaveLength(1);
  });

  it("no breakpoint hides the bottom menu", () => {
    expect(shell).not.toMatch(/md:hidden/);
    expect(read("components/consumer/BottomNav.tsx")).not.toMatch(
      /\b(?:sm|md|lg):hidden\b/,
    );
  });

  it("there is no anonymous-browse door left (MESITA-2137)", () => {
    for (const gone of [
      "components/consumer/DownloadAppScreen.tsx",
      "components/consumer/SurfaceSwitch.tsx",
      "lib/web-surface-auth.ts",
      "app/(shell)/get-the-app/page.tsx",
    ]) {
      expect(existsSync(join(SRC, gone)), gone).toBe(false);
    }
    expect(read("lib/supabase/middleware.ts")).not.toContain(
      "signInAnonymously(",
    );
  });
});
