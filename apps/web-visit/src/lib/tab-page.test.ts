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

describe("the waiter's tab screen", () => {
  it("polls by the QR token only and stops when the tab is done", () => {
    expect(API).toMatch(/post\("visit-web-get-tab", \{ token \}\)/);
    expect(PAGE).toMatch(/const DONE = \["paid", "expired", "cancelled"\]/);
    expect(PAGE).toMatch(/if \(stopped\) return;/);
  });

  it("keeps the staff token, never the place code", () => {
    expect(PAGE).toMatch(/localStorage\.setItem\(staffKeyFor\(placeId\), JSON\.stringify\(\{ token, expires_at/);
    expect(PAGE).not.toMatch(/setItem\([^)]*placeCode/);
    expect(PAGE).not.toMatch(/sessionStorage/);
  });

  it("sends the bill and Received with a staff key and the bill version", () => {
    expect(PAGE).toMatch(/billTab\(\{ token, bill_cents: billCents, tip_cents: tipCents, ticket: [^}]*bill_version: tab\.bill_version, \.\.\.staffKey\(\) \}\)/);
    expect(PAGE).toMatch(/cashTab\(\{ token, cash_received_cents: cashCents, \.\.\.staffKey\(\) \}\)/);
  });

  it("shows the test band and never who the guest is", () => {
    expect(PAGE).toContain('import { TEST_BAND_TEXT } from "@mesita/place-profile/lib/test-band"');
    expect(PAGE).not.toMatch(/consumer|guest_name|member/);
  });
});
