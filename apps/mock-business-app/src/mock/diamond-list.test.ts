// THE DIAMOND LIST (MESITA-2044). Pato: "there are no classes, either you are
// diamond or you are not. its more like a List." A guest is on the Diamond
// List or not, so the console never shows staff a guest's metal — no Bronze,
// Silver or Gold, no VIP, and never "Diamond" alone as a status noun.
//
// Two pins: the guest fixture carries the list as a boolean and nothing else,
// and no source file under src/ can print a metal. The rewards engine
// (`lib/rewards.ts`) still holds lowercase storage keys; the metal pattern is
// case-sensitive, so those keys are not what it looks for.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CUSTOMERS } from "./fixtures";

const SRC = path.join(__dirname, "..");

const METALS =
  /\b(Bronze|Silver|Gold|VIP)\b|You're Diamond|Not Diamond|Diamond guests?|\bDiamond\b(?! List)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
    return [full];
  });
}

/** The source with comments removed — what could reach a screen. */
function renderable(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the Diamond List in the mock", () => {
  it("every guest is on the list or not, and carries no class", () => {
    expect(CUSTOMERS.length).toBeGreaterThan(0);
    for (const c of CUSTOMERS) {
      expect(typeof c.diamondList).toBe("boolean");
      expect(c).not.toHaveProperty("class");
    }
    // Invitation-only reads as rare: somebody is on it, most are not.
    const on = CUSTOMERS.filter((c) => c.diamondList).length;
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(CUSTOMERS.length / 4);
  });

  it("no source file renders Bronze, Silver, Gold, VIP or a bare Diamond", () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    const hits = files.flatMap((f) => {
      const m = renderable(f).match(METALS);
      return m ? [`${path.relative(SRC, f)}: ${m[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });

  it("the pattern bites", () => {
    for (const s of ['"Silver"', "VIP guest", "You're Diamond", "Diamond guests"]) {
      expect(METALS.test(s)).toBe(true);
    }
    expect(METALS.test("On the Diamond List")).toBe(false);
    expect(METALS.test('tone="gold"')).toBe(false);
  });
});
