// Money (MESITA-3549): what a refused voucher buy does on the place screen.
import { describe, expect, it } from "vitest";
import { BUY_REFUSAL, buyRefusalAction } from "@/lib/api/wallet";

describe("buyRefusalAction", () => {
  it("resumes the open Checkout when the refusal carries its url", () => {
    expect(buyRefusalAction("in_progress", { url: "https://checkout.stripe.com/c/pay/cs_test_1" })).toEqual({
      kind: "open",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
  });
  it("says the cap line and keeps the offer on place_cap", () => {
    expect(buyRefusalAction("place_cap", null)).toEqual({ kind: "say", line: BUY_REFUSAL.place_cap, reload: false });
  });
  it("says the line and reloads the offer otherwise; an unknown code reads checkout_failed", () => {
    expect(buyRefusalAction("paused", null)).toEqual({ kind: "say", line: BUY_REFUSAL.paused, reload: true });
    expect(buyRefusalAction("in_progress", {})).toEqual({ kind: "say", line: BUY_REFUSAL.in_progress, reload: true });
    expect(buyRefusalAction("nope", null)).toEqual({ kind: "say", line: BUY_REFUSAL.checkout_failed, reload: true });
  });
});
