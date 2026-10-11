import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BELOW md, /web IS THE PHONE VIEW (Pato, MESITA-2130: "when not wide, use
// the normal menu with phone view").
//
// One breakpoint splits the two menus: the sidebar from md up, BottomNav
// below it. Nothing here renders in jsdom at a width, so the guard is on the
// source: WebFrame adds no phone-width chrome of its own (the phone app has no
// header), and every /web screen the shell draws, the no-session one
// included, carries BottomNav below md.

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("/web at phone width is the phone view", () => {
  const frame = read("components/consumer/WebFrame.tsx");
  const shell = read("app/(shell)/layout.tsx");

  it("the sidebar is the menu from md up, and only there", () => {
    expect(frame).toMatch(/<aside[^>]*\bhidden\b[^>]*\bmd:flex\b/);
  });

  it("WebFrame adds nothing at phone width", () => {
    expect(frame).not.toMatch(/\bmd:hidden\b/);
  });

  it("every /web return in the shell carries BottomNav below md", () => {
    const noSession = shell.slice(
      shell.indexOf('if (!user && surface === "web")'),
      shell.indexOf("</WebFrame>"),
    );
    expect(noSession).toContain("<DownloadAppScreen />");
    expect(noSession).toMatch(/<BottomNav className="md:hidden" \/>/);
    expect(shell).toMatch(
      /<BottomNav[\s\S]*?surface === "web" \? "md:hidden" : undefined/,
    );
  });
});
