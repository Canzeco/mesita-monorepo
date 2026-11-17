import { afterEach, describe, expect, it } from "vitest";
import { anonymousGate, saveSignIntent, takeSignIntent } from "@/lib/anonymous";

// MESITA-4246: what a visitor without an onboarded account may call. No
// social event, no paid Google call and no write leaves; an action sends
// them to Sign.

describe("anonymousGate", () => {
  it("a member passes everything", () => {
    expect(anonymousGate("member", "consumer-web-buy-voucher", {}).kind).toBe("pass");
  });

  it("an anonymous visitor reads the public places and Social", () => {
    for (const fn of ["consumer-web-get-place", "consumer-web-list-activity", "consumer-web-list-place-likes"]) {
      expect(anonymousGate("anonymous", fn, {}).kind).toBe("pass");
    }
  });

  it("tracking, paid Google calls and member reads never leave", () => {
    for (const fn of [
      "consumer-web-track-event",
      "consumer-web-suggest-places",
      "consumer-web-reverse-geocode",
      "consumer-web-get-wallet",
      "consumer-web-some-future-write",
    ]) {
      expect(anonymousGate("anonymous", fn, {}).kind, fn).toBe("quiet");
    }
    expect(anonymousGate("anonymous", "consumer-web-track-activity", { kind: "viewed", place_id: "p" }).kind).toBe("quiet");
  });

  it("a save or a buy sends the visitor to Sign; the save is kept", () => {
    expect(anonymousGate("anonymous", "consumer-web-track-activity", { kind: "saved", place_id: "p1" })).toEqual({
      kind: "sign",
      intent: { kind: "save", placeId: "p1" },
    });
    expect(anonymousGate("anonymous", "consumer-web-buy-voucher", {}).kind).toBe("sign");
  });

  it("an unknown viewer (failed profile read) still acts; only tracking is quiet", () => {
    expect(anonymousGate("unknown", "consumer-web-buy-voucher", {}).kind).toBe("pass");
    expect(anonymousGate("unknown", "consumer-web-track-event", {}).kind).toBe("quiet");
  });
});

describe("the sign intent", () => {
  afterEach(() => sessionStorage.clear());

  it("is read once", () => {
    saveSignIntent({ kind: "save", placeId: "p1" });
    expect(takeSignIntent()).toEqual({ kind: "save", placeId: "p1" });
    expect(takeSignIntent()).toBeNull();
  });

  it("expires after 30 minutes", () => {
    sessionStorage.setItem("mesita.signIntent", JSON.stringify({ kind: "save", placeId: "p1", at: Date.now() - 31 * 60_000 }));
    expect(takeSignIntent()).toBeNull();
  });
});
