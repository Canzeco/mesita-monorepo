// Money (MESITA-3549, MESITA-4065): what a refused voucher buy does on the
// place screen, and which refusals start a new request_id (a retry after an
// unknown outcome must reuse it, or the guest can be charged twice).
import { describe, expect, it } from "vitest";
import { BUY_REFUSAL, buyRefusalAction, isDefinitiveRefusal } from "@/lib/api/wallet";

describe("buyRefusalAction", () => {
  it("opens the card sheet when the server needs a card", () => {
    expect(buyRefusalAction("card_required")).toEqual({ kind: "add_card", line: BUY_REFUSAL.card_required });
  });
  it("lists the cards again when the chosen card is gone", () => {
    expect(buyRefusalAction("card_not_found")).toEqual({ kind: "reload_cards", line: BUY_REFUSAL.card_not_found });
  });
  it("opens the full window on place_cap", () => {
    expect(buyRefusalAction("place_cap")).toEqual({ kind: "full", line: BUY_REFUSAL.place_cap });
  });
  it("says the line and reloads the offer otherwise; an unknown code reads failed", () => {
    expect(buyRefusalAction("paused")).toEqual({ kind: "say", line: BUY_REFUSAL.paused, reload: true });
    expect(buyRefusalAction("nope")).toEqual({ kind: "say", line: BUY_REFUSAL.failed, reload: true });
  });
});

describe("isDefinitiveRefusal", () => {
  it("a 4xx answer is definitive: the next tap is a new purchase", () => {
    expect(isDefinitiveRefusal(409, "card_declined")).toBe(true);
    expect(isDefinitiveRefusal(404, "card_not_found")).toBe(true);
  });
  it("no answer, a 5xx or a charge that may have run keeps the same request_id", () => {
    expect(isDefinitiveRefusal(null, null)).toBe(false);
    expect(isDefinitiveRefusal(502, "card_failed")).toBe(false);
    expect(isDefinitiveRefusal(502, "stripe_unreachable")).toBe(false);
    expect(isDefinitiveRefusal(409, "in_progress")).toBe(false);
    expect(isDefinitiveRefusal(500, null)).toBe(false);
  });
});
