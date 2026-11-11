// The Wallet card's big number (MESITA-3511): money the guest cannot spend
// yet must never read as spendable.
import { describe, expect, it } from "vitest";
import { cardAmount, GIFT_EMPTY, GIFT_PENDING, giftAction } from "@/lib/wallet-card";

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

// Money gate (MESITA-3727): Gift on a Wallet Credits Card opens the send sheet
// only when the guest can send and has spendable credit.
describe("giftAction", () => {
  it("opens when sending is on and credit can be spent now", () => {
    expect(giftAction({ canSend: true, spendableCents: 5_000, shownCents: 5_000 })).toBe("open");
  });

  it("explains pending or held credit instead of opening", () => {
    expect(giftAction({ canSend: true, spendableCents: 0, shownCents: 20_000 })).toEqual({ blocked: GIFT_PENDING });
  });

  it("asks to fund an empty card", () => {
    expect(giftAction({ canSend: true, spendableCents: 0, shownCents: 0 })).toEqual({ blocked: GIFT_EMPTY });
  });

  it("is hidden when sending is off, whatever the balance", () => {
    expect(giftAction({ canSend: false, spendableCents: 5_000, shownCents: 5_000 })).toBeNull();
  });
});
