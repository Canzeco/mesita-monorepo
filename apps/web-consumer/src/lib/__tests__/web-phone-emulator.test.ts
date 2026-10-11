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

  it("every shell return draws the phone card with the bottom menu", () => {
    const frames = [...shell.matchAll(/<MobileFrame surface=/g)];
    expect(frames).toHaveLength(2);
    expect([...shell.matchAll(/<BottomNav\b/g)]).toHaveLength(2);
  });

  it("no breakpoint hides the bottom menu", () => {
    expect(shell).not.toMatch(/md:hidden/);
    expect(read("components/consumer/BottomNav.tsx")).not.toMatch(
      /\b(?:sm|md|lg):hidden\b/,
    );
  });

  it("the strip links to the other way in, never to itself", () => {
    const frame = read("components/consumer/MobileFrame.tsx");
    expect(frame).toMatch(/surface === "mob"\s*\?\s*\{ href: "\/web"/);
    expect(frame).toMatch(/\{ href: "\/mob", label: "Sign in" \}/);
  });
});
