// THE PASSPORT DOCUMENT IS A HAND-MIRRORED TWIN (MESITA-1820).
//
// `lib/passport-document.ts` exists twice — once here, once at
// `apps/mobile-consumer/src/lib/passport-document.ts` — because the module is
// pure TS with zero platform deps and both apps print the SAME document for
// the same guest. Consumer IA cannot diverge, and a passport that prints a
// different MRZ, a different field list or a different completion count
// depending on which app the guest opened is the loudest possible divergence.
//
// Until now nothing checked that. The mirrored twins in this repo have gone
// out of sync silently before (MESITA-1887 landed a flat-twin regression that
// every check was green for), so the twin gets the same pin the others have:
// ticket-journey-drift.test.ts and ticket-state-drift.test.ts. Mobile has no
// test runner (its package.json is lint + typecheck only), so this equality
// pin on web is the mobile copy's only coverage.
//
// WHY NOT BYTE-IDENTICAL, LIKE ticket-journey. That twin is literally the same
// file. This one is not: mobile is on single quotes and its header comment
// points at mobile's renderer and mobile's profile source, so a byte compare
// would fail on prose that is CORRECT and the cheapest green would be pasting
// web's wrong comments into mobile. So the comparison strips comment and blank
// lines and normalises quote style, and what is left — every line of executable
// logic, every literal, every field id, every label — must match exactly.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const WEB = "apps/web-consumer/src/lib/passport-document.ts";
const MOBILE = "apps/mobile-consumer/src/lib/passport-document.ts";

/** Code only: comment lines and blank lines out, `'` folded to `"`. Applied to
 *  both sides, so an apostrophe inside a string folds the same way on each and
 *  cannot manufacture a false match between two different strings. */
function code(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return (
        t !== "" &&
        !t.startsWith("//") &&
        !t.startsWith("/*") &&
        !t.startsWith("*")
      );
    })
    .map((line) => line.replace(/'/g, '"'))
    .join("\n");
}

describe("passport-document drift (web ↔ mobile)", () => {
  const web = code(WEB);

  // The comparison below is only worth anything if `code()` actually returned
  // the module. A test that compares two empty strings passes forever.
  it("reads a real module, not an empty file", () => {
    expect(web).toContain("export function passportFields");
    expect(web).toContain("export function buildMrz");
    expect(web).toContain("export function completionLine");
    expect(web.split("\n").length).toBeGreaterThan(100);
  });

  it("mobile's copy is line-for-line identical to web's, comments aside", () => {
    expect(code(MOBILE)).toBe(web);
  });
});
