import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pato (MESITA-2357): "make the bottom menu dark, and top menu too".
const read = (rel: string) =>
  readFileSync(join(__dirname, "../../components/consumer", rel), "utf8");

describe("the bottom bar and Home's mode tabs are dark (MESITA-2357)", () => {
  it("the bottom bar is the ink surface, paper text", () => {
    const nav = read("BottomNav.tsx");
    expect(nav).toContain("border-foreground bg-foreground text-paper");
    expect(nav).toContain('active ? "text-paper" : "text-paper/55');
    expect(nav).not.toContain("bg-card/95");
  });

  it("the mode tabs row is the ink surface; the active pill inverts", () => {
    const tabs = read("ModeTabs.tsx");
    expect(tabs).toContain("border-foreground bg-foreground sticky top-0");
    expect(tabs).toContain('const active = "bg-paper text-foreground";');
    expect(tabs).not.toContain("bg-background/90");
  });
});
