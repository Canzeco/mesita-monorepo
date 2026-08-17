// THE TICKET v4 on mobile (MESITA-1094): mobile-consumer mirrors
// `lib/ticket-journey.ts` BYTE-IDENTICALLY — the module is pure TS with zero
// platform deps, so the two copies can and must be the same file. mobile has
// no test runner; this equality pin is its coverage, same mechanism as the
// status-constant drift test.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

describe("ticket-journey drift (web ↔ mobile)", () => {
  it("mobile's copy is byte-identical to web's", () => {
    const web = readFileSync(
      join(REPO_ROOT, "apps/web-consumer/src/lib/ticket-journey.ts"),
      "utf8",
    );
    const mobile = readFileSync(
      join(REPO_ROOT, "apps/mobile-consumer/src/lib/ticket-journey.ts"),
      "utf8",
    );
    expect(mobile).toBe(web);
  });
});
