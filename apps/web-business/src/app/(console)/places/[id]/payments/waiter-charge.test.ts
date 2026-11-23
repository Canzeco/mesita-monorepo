// Money (MESITA-3306; MESITA-4485): cash is never gated on a waiter code, and
// this page has no control for accepting codes. Since MESITA-4752 cash, card
// and credits are always accepted at the visit: the page asks nothing about
// them (cash_payments is on for every place, migration 20261123163000).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("the place code on Payments", () => {
  it("does not gate cash on a waiter code, and links the waiter's screen", () => {
    expect(PANEL).not.toContain("<WaiterCodeRow");
    expect(PANEL).not.toContain("Set the waiter code first.");
    expect(PANEL).toContain("/charge/${encodeURIComponent(placeId)}");
  });

  it("never lets an owner turn cash off (it is always accepted)", () => {
    expect(PANEL).not.toContain('flip("cash_payments"');
    expect(PANEL).not.toContain('key: "cash_payments"');
  });
});
