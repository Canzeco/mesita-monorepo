// Money and auth (MESITA-3565): the waiter's tab screen. The poll carries
// the QR token only (never the place code or a staff token); it stops at
// Paid, Expired and Cancelled; the place code is never kept on the device,
// only the staff token the server minted; Received and the bill carry a
// staff key; a test tab wears the test band; nothing names the guest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(join(__dirname, "..", "app", "tab", "[token]", "page.tsx"), "utf8");
const API = readFileSync(join(__dirname, "visit-api.ts"), "utf8");
const STAFF_KEY = readFileSync(join(__dirname, "staff-key.ts"), "utf8");
const STAFF_PAGE = readFileSync(join(__dirname, "..", "app", "staff", "[place]", "page.tsx"), "utf8");

describe("the waiter's tab screen", () => {
  it("polls by the QR token only and stops when the tab is done", () => {
    expect(API).toMatch(/post\("visit-web-get-tab", \{ token \}\)/);
    expect(PAGE).toMatch(/const DONE = \["paid", "expired", "cancelled"\]/);
    expect(PAGE).toMatch(/if \(stopped\) return;/);
  });

  it("keeps the staff token, never the place code or the Staff QR's secret", () => {
    // MESITA-3696: the store moved to lib/staff-key.ts, shared with /staff.
    expect(PAGE).toContain('import { keepStaff, readStaff } from "@/lib/staff-key"');
    expect(STAFF_KEY).toMatch(/localStorage\.setItem\(staffKeyFor\(placeId\), JSON\.stringify\(\{ token, expires_at/);
    expect(STAFF_PAGE).toMatch(/keepStaff\(place, r\.staff_token, r\.staff_token_expires_at\)/);
    expect(STAFF_PAGE).toContain('window.history.replaceState(null, "", window.location.pathname)');
    for (const src of [PAGE, STAFF_PAGE]) {
      expect(src).not.toMatch(/setItem\([^)]*(placeCode|secret)/);
      expect(src).not.toMatch(/sessionStorage/);
    }
  });

  it("sends the bill and Received with a staff key and the bill version", () => {
    expect(PAGE).toMatch(/billTab\(\{ token, bill_cents: billCents, tip_cents: tipCents, ticket: [^}]*bill_version: tab\.bill_version, \.\.\.staffKey\(\) \}\)/);
    // MESITA-3695: a split bill's share is confirmed by its id, under this tab's token, with a staff key.
    expect(PAGE).toMatch(/cashTab\(\{ token, cash_received_cents: shareTabId \? null : cashCents, \.\.\.\(shareTabId \? \{ share_tab_id: shareTabId \} : \{\}\), \.\.\.staffKey\(\) \}\)/);
  });

  it("shows the test band and never who the guest is", () => {
    expect(PAGE).toContain('import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band"');
    expect(PAGE).not.toMatch(/consumer|guest_name|member/);
  });
});
