// Money (MESITA-3306): the waiter's charge answers place_code_required while
// the place has no code, so the owner's Payments page must say so, from the
// server's code_set, and never gate a switch on it (gate d2).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("the waiter's charge note", () => {
  it("says to set a place code while code_set is false, and links the charge once it is", () => {
    expect(PANEL).toContain('"Set a place code on Settings to take the waiter\'s charge"');
    expect(PANEL).toMatch(/code_set: codeSet/);
    expect(PANEL).toMatch(/codeSet \? \(/);
    expect(PANEL).toContain("/charge/${encodeURIComponent(placeId)}");
  });

  it("never gates a switch on the place code", () => {
    const row = PANEL.slice(PANEL.indexOf("const row = "), PANEL.indexOf("const infoRow"));
    expect(row).not.toMatch(/codeSet/);
  });
});
