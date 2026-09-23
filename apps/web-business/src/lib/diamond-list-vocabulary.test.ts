import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// THE DIAMOND LIST (MESITA-2044). Pato: "there are no classes, either you are
// diamond or you are not. its more like a List." A guest is on the Diamond
// List or not, so the business console never shows staff a metal: no Bronze,
// Silver or Gold, no VIP, and never "Diamond" alone as a status noun.
//
// Nothing in this console renders a guest's identity today. This pins that:
// the day a screen prints a guest's metal, it fails here.

const SRC = path.join(__dirname, "..");

// The rewards engine twin of web-admin's promos.ts. It still carries the four
// stored class keys and a CLASS_META nobody here imports — the test below
// proves that, which is what makes leaving it out of the scan safe.
const ENGINE_TWIN = path.join(SRC, "lib", "rewards", "promos.ts");

const METALS =
  /\b(Bronze|Silver|Gold|VIP)\b|You're Diamond|Not Diamond|Diamond guests?|\bDiamond\b(?! List)/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx)$/.test(name)) return [];
    if (/\.test\.(ts|tsx)$/.test(name)) return [];
    if (name === "database.types.ts") return [];
    return [full];
  });
}

/** The source with comments removed — what could reach a screen. */
function renderable(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the business console shows staff no guest metal", () => {
  const files = sourceFiles(SRC).filter((f) => f !== ENGINE_TWIN);

  it("scans a real tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no source file renders Bronze, Silver, Gold, VIP or a bare Diamond", () => {
    const hits = files.flatMap((f) => {
      const m = renderable(f).match(METALS);
      return m ? [`${path.relative(SRC, f)}: ${m[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });

  it("no screen imports the engine twin's class labels", () => {
    const importers = files.filter((f) =>
      /\bCLASS_META\b/.test(renderable(f)),
    );
    expect(importers.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it("the pattern bites", () => {
    for (const s of ['"Gold"', "VIP guest", "You're Diamond", "Diamond guests"]) {
      expect(METALS.test(s)).toBe(true);
    }
    expect(METALS.test("On the Diamond List")).toBe(false);
    expect(METALS.test("tier-gold")).toBe(false);
  });
});
