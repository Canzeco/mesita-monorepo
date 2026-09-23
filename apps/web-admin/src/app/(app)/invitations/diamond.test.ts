import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIAMOND_KEY,
  diamondLabel,
  isDiamondKey,
} from "./class-bridge";

// DIAMOND (MESITA-2044, MESITA-2046). Pato: "there are no classes, either you
// are diamond or you are not" — and then "Don't call diamond list, just
// diamond". The admin page that makes guests Diamond reads two states and
// sends one key; a metal, a ladder word or the retired "Diamond List"
// anywhere on it fails here.

// Two halves: the ladder words in any case, and the metals only as a person
// reads them (Capitalised) — the lowercase storage keys `bronze`/`silver`/
// `gold`/`diamond` are what the class-bridge has to parse, and stay.
const LADDER_WORDS =
  /\b(vip|class|classes|tier|tiers|rank|rung|rungs|level|ladder|climb)\b|unlock a higher/i;
const METALS =
  /\b(Bronze|Silver|Gold)\b|Diamond List|Lista Diamante/;
const BANNED = {
  test: (s: string) => LADDER_WORDS.test(s) || METALS.test(s),
  match: (s: string) => s.match(LADDER_WORDS) ?? s.match(METALS),
};

/** The source with comments and import lines removed — what can render. */
function renderable(file: string): string {
  return readFileSync(path.join(__dirname, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .split("\n")
    .filter((line) => !/^\s*(import|from)\b|^\s*}\s*from\s/.test(line))
    .join("\n");
}

describe("Diamond, admin side", () => {
  it("sends exactly one key: diamond", () => {
    expect(DIAMOND_KEY).toBe("diamond");
  });

  it("reads every stored key as Diamond or not — never a metal", () => {
    const on = ["diamond", "aura"];
    const off = [
      null,
      "bronze",
      "silver",
      "gold",
      "standard",
      "influencer",
      "premium",
    ];
    for (const k of on) {
      expect(isDiamondKey(k)).toBe(true);
      expect(diamondLabel(k)).toBe("Diamond");
    }
    for (const k of off) {
      expect(isDiamondKey(k)).toBe(false);
      expect(diamondLabel(k)).toBe("Not Diamond");
    }
    // An unknown key prints as itself, never silently as "not Diamond".
    expect(diamondLabel("platinum")).toBe("platinum");
  });

  // actions.ts is left out on purpose: it names the EF, and
  // `admin-web-grant-class` keeps its name (a label never moves an EF).
  it.each(["InvitationsClient.tsx", "class-bridge.ts", "nav.ts"])(
    "%s renders no metal, ladder word, or Diamond List",
    (file) => {
      const hit = BANNED.match(renderable(file));
      expect(hit?.[0] ?? null).toBeNull();
    },
  );

  it("the pattern bites", () => {
    // Proves the scan is not vacuous: the strings this page used to carry.
    for (const s of [
      'label: "Silver"',
      "Add to the Diamond List",
      'label="Effective class"',
      "Top of the ladder",
      "On the Diamond List",
    ]) {
      expect(BANNED.test(s)).toBe(true);
    }
    expect(BANNED.test("Make Diamond")).toBe(false);
    expect(BANNED.test("Not Diamond")).toBe(false);
  });
});
