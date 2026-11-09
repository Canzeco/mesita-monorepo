// Privacy (MESITA-3462): the staff list's 15-second read carries the staff
// token, never the place code (a code in a poll is a secret sent every 15 s),
// and a staff_only answer drops the token and returns to the code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(join(__dirname, "..", "app", "payments", "[place]", "page.tsx"), "utf8");

describe("the staff list of payments", () => {
  it("reads by staff token only and drops it on staff_only", () => {
    const tick = PAGE.slice(PAGE.indexOf("const tick"), PAGE.indexOf("const start"));
    expect(tick).toContain("listPayments({ place_id: place, staff_token: token })");
    expect(tick).not.toContain("place_code");
    expect(tick).toMatch(/r\.kind === "staff_only"\) \{\s*stopped = true;/);
  });

  it("never says who paid", () => {
    expect(PAGE).not.toMatch(/consumer|guest_name|member/);
  });
});
