// Money (MESITA-3304): while Stripe is in test mode the staff page says so,
// in the same words every money surface wears, so no waiter takes a test
// proof as money. A money/legal guard under the MVP test rule.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROOF = readFileSync(join(__dirname, "..", "app", "proof", "[token]", "page.tsx"), "utf8");

describe("the proof page in test mode", () => {
  it("shows the shared test band words from the server's flag", () => {
    expect(PROOF).toContain('import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band"');
    expect(PROOF).toMatch(/proof\.test_mode \? \(\s*<p className="test-band"/);
  });

  it("never shows who paid: the page reads only the proof's fields", () => {
    expect(PROOF).not.toMatch(/consumer|guest_name|member/);
  });
});
