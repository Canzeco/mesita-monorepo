// Money (MESITA-3306; MESITA-4823): waiters send the bills, so the owner sets
// the waiter code here again; cash is never gated on it. Since MESITA-4752 cash, card
// and credits are always accepted at the visit: the page asks nothing about
// them (cash_payments is on for every place, migration 20261123163000).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(join(__dirname, "PaymentsPanel.tsx"), "utf8");

describe("the place code on Payments", () => {
  it("sets the waiter code (MESITA-4827), and never gates cash on it", () => {
    expect(PANEL).toContain("<WaiterCodeRow");
    expect(PANEL).not.toContain("Set the waiter code first.");
  });

  it("never lets an owner turn cash off (it is always accepted)", () => {
    expect(PANEL).not.toContain('flip("cash_payments"');
    expect(PANEL).not.toContain('key: "cash_payments"');
  });
});
