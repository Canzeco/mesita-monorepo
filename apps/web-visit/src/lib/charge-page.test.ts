// Money (MESITA-3306): the waiter's charge screen. The poll carries the
// charge token only, never the place code (a place code in a poll is a
// secret sent every 3 s); it stops at Paid and at Expired; the four states
// exist; a test charge wears the test band so no waiter takes it as money.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(join(__dirname, "..", "app", "charge", "[place]", "page.tsx"), "utf8");
const API = readFileSync(join(__dirname, "visit-api.ts"), "utf8");

describe("the waiter's charge screen", () => {
  it("has the four states", () => {
    for (const s of ["open", "paid", "expired", "reconnecting"]) expect(PAGE).toContain(`data-charge-state="${s}"`);
    expect(PAGE).toMatch(/misses >= 2/);
  });

  it("polls every 3 s by token only and stops at Paid and Expired", () => {
    expect(PAGE).toMatch(/POLL_MS = 3000/);
    expect(PAGE).toMatch(/getCharge\(token\)/);
    expect(API).toMatch(/post\("visit-web-get-charge", \{ token \}\)/);
    const tick = PAGE.slice(PAGE.indexOf("const tick"), PAGE.indexOf("const poll"));
    expect(tick).toMatch(/r === "gone"\) \{\s*stopped = true;/);
    expect(tick).toMatch(/r\.state === "paid"\) \{\s*stopped = true;/);
  });

  it("shows the test band from the server's flag and never who paid", () => {
    expect(PAGE).toContain('import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band"');
    expect(PAGE).not.toMatch(/consumer|guest_name|member/);
  });
});
