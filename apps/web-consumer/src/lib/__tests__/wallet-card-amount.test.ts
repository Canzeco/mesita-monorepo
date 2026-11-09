// The Wallet card's big number (MESITA-3511): money the guest cannot spend
// yet must never read as spendable.
import { describe, expect, it } from "vitest";
import { cardAmount } from "@/lib/wallet-card";

describe("cardAmount", () => {
  it("shows Available, untagged, when there is any", () => {
    expect(cardAmount({ available_cents: 22_000, pending_cents: 11_000 })).toEqual({ cents: 22_000, pending: false });
  });

  it("shows Pending, tagged, when nothing is available yet", () => {
    expect(cardAmount({ available_cents: 0, pending_cents: 22_000 })).toEqual({ cents: 22_000, pending: true });
  });

  it("shows zero, untagged, when there is nothing", () => {
    expect(cardAmount({ available_cents: 0, pending_cents: 0 })).toEqual({ cents: 0, pending: false });
  });
});
