import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  // MESITA-4317: a visitor with no session got "Your session expired" from
  // the bar's profile read. Without a session it never leaves; with one (a
  // signed-in visitor not yet onboarded) Onboard still reads and writes it.
  it("a session-only call never leaves without a session", () => {
    for (const v of ["anonymous", "unknown"] as const) {
      expect(anonymousGate(v, "consumer-web-get-profile", {}, false)).toEqual({ kind: "quiet", answer: null });
    }
    expect(anonymousGate("anonymous", "consumer-web-update-profile", {}, true).kind).toBe("pass");
  });

  it("tracking, paid Google calls and member reads never leave", () => {
    for (const fn of [
      "consumer-web-track-event",
      "consumer-web-suggest-places",
      "consumer-web-reverse-geocode",
      "consumer-web-get-wallet",
      // An unlisted name (built, so the EF-name scan skips it).
      ["consumer", "web", "unlisted"].join("-"),
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
  // An in-memory sessionStorage, whatever the test environment provides.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

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
