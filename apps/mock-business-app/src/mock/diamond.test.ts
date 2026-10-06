// DIAMOND (MESITA-2044, MESITA-2046). Pato: "there are no classes, either you
// are diamond or you are not" — and then "Don't call diamond list, just
// diamond". A guest is Diamond or not, so the console never shows staff a
// guest's metal — no Bronze, Silver or Gold, no VIP, and never the retired
// "Diamond List".
//
// Two pins: the guest fixture carries Diamond as a boolean and nothing else,
// and no source file under src/ can print a metal. The rewards engine
// (`lib/rewards.ts`) still holds lowercase storage keys; the metal pattern is
// case-sensitive, so those keys are not what it looks for.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CUSTOMERS } from "./fixtures";

const SRC = path.join(__dirname, "..");

const METALS =
  /\b(Bronze|Silver|Gold|VIP)\b|Diamond List|Lista Diamante|Diamond (class|tier|rung)/;

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

describe("Diamond in the mock", () => {
  it("every guest is Diamond or not, and carries no class", () => {
    expect(CUSTOMERS.length).toBeGreaterThan(0);
    for (const c of CUSTOMERS) {
      expect(typeof c.diamond).toBe("boolean");
      expect(c).not.toHaveProperty("class");
    }
    // Invitation-only reads as rare: somebody is Diamond, most are not.
    const on = CUSTOMERS.filter((c) => c.diamond).length;
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThan(CUSTOMERS.length / 4);
  });

  it("no source file renders Bronze, Silver, Gold, VIP or the Diamond List", () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    const hits = files.flatMap((f) => {
      const m = renderable(f).match(METALS);
      return m ? [`${path.relative(SRC, f)}: ${m[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });

  it("the pattern bites", () => {
    for (const s of ['"Silver"', "VIP guest", "On the Diamond List", "Diamond tier"]) {
      expect(METALS.test(s)).toBe(true);
    }
    expect(METALS.test("You're Diamond")).toBe(false);
    expect(METALS.test('tone="gold"')).toBe(false);
  });
});
