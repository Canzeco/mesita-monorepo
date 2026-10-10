import { describe, expect, it } from "vitest";

import { webRequiresRegisteredAccount } from "../web-surface-auth";

describe("web surface auth", () => {
  it("lets anonymous guests browse discovery and places", () => {
    expect(webRequiresRegisteredAccount("/discover/scroll")).toBe(false);
    expect(webRequiresRegisteredAccount("/search")).toBe(false);
    expect(webRequiresRegisteredAccount("/place/abc")).toBe(false);
    expect(webRequiresRegisteredAccount("/get-the-app")).toBe(false);
  });

  // First Stage routes (MESITA-2087 deleted Wallet and Visit): every account
  // surface the guest can still reach sends an anonymous session to the app.
  it("sends account features to get-the-app", () => {
    expect(webRequiresRegisteredAccount("/me")).toBe(true);
    expect(webRequiresRegisteredAccount("/me/profile")).toBe(true);
    expect(webRequiresRegisteredAccount("/pay")).toBe(true);
    expect(webRequiresRegisteredAccount("/reservations")).toBe(true);
    expect(webRequiresRegisteredAccount("/reservation/x")).toBe(true);
    expect(webRequiresRegisteredAccount("/onboard")).toBe(true);
  });
});
