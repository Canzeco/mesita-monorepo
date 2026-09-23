import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIAMOND_LIST_KEY,
  diamondListLabel,
  isOnDiamondList,
} from "./class-bridge";

// THE DIAMOND LIST (MESITA-2044). Pato: "there are no classes, either you are
// diamond or you are not. its more like a List." The admin page that adds and
// removes guests reads two states and sends one key; a metal, a ladder word or
// "Diamond" alone as a status noun anywhere on it fails here.

// Two halves: the ladder words in any case, and the metals only as a person
// reads them (Capitalised) — the lowercase storage keys `bronze`/`silver`/
// `gold`/`diamond` are what the class-bridge has to parse, and stay.
const LADDER_WORDS =
  /\b(vip|class|classes|tier|tiers|rank|rung|rungs|level|ladder|climb)\b|unlock a higher/i;
const METALS =
  /\b(Bronze|Silver|Gold)\b|You're Diamond|Not Diamond|Diamond guests?|\bDiamond\b(?! List)/;
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

describe("the Diamond List, admin side", () => {
  it("sends exactly one key: diamond", () => {
    expect(DIAMOND_LIST_KEY).toBe("diamond");
  });

  it("reads every stored key as on the list or not — never a metal", () => {
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
      expect(isOnDiamondList(k)).toBe(true);
      expect(diamondListLabel(k)).toBe("On the Diamond List");
    }
    for (const k of off) {
      expect(isOnDiamondList(k)).toBe(false);
      expect(diamondListLabel(k)).toBe("Not on the list");
    }
    // An unknown key prints as itself, never silently as "not on the list".
    expect(diamondListLabel("platinum")).toBe("platinum");
  });

  // actions.ts is left out on purpose: it names the EF, and
  // `admin-web-grant-class` keeps its name (a label never moves an EF).
  it.each(["InvitationsClient.tsx", "class-bridge.ts", "nav.ts"])(
    "%s renders no metal, ladder word, or bare Diamond",
    (file) => {
      const hit = BANNED.match(renderable(file));
      expect(hit?.[0] ?? null).toBeNull();
    },
  );

  it("the pattern bites", () => {
    // Proves the scan is not vacuous: the strings this page used to carry.
    for (const s of [
      'label: "Silver"',
      "Grant Diamond",
      'label="Effective class"',
      "Top of the ladder",
      "You're Diamond",
    ]) {
      expect(BANNED.test(s)).toBe(true);
    }
    expect(BANNED.test("Add to the Diamond List")).toBe(false);
  });
});
