// MESITA-4229 — sign-in reads a friend's gift link from `?next=` so it can say
// what the link holds. The key is case-sensitive: a lowercased key is a dead
// link, so the parser never folds case.
import { describe, expect, it } from "vitest";
import { giftTokenFromNext } from "../auth-redirect";

const T = "aB3_x-Yz09QwErTyUiOpAs";

describe("giftTokenFromNext", () => {
  it("reads the key from a gift link, case intact", () => {
    expect(giftTokenFromNext(`/wallet/gift/${T}`)).toBe(T);
  });

  it("tolerates a query an app adds to the link", () => {
    expect(giftTokenFromNext(`/wallet/gift/${T}?fbclid=abc`)).toBe(T);
  });

  it("reads the older /wallet?gift= address", () => {
    expect(giftTokenFromNext(`/wallet?gift=${T}`)).toBe(T);
    expect(giftTokenFromNext(`/wallet?x=1&gift=${T}`)).toBe(T);
  });

  it("is null for anything that isn't a gift link", () => {
    expect(giftTokenFromNext(undefined)).toBeNull();
    expect(giftTokenFromNext("/pay/place/00000000-0000-4000-8000-000000000001")).toBeNull();
    expect(giftTokenFromNext(`//evil.com/wallet/gift/${T}`)).toBeNull();
    expect(giftTokenFromNext(`/wallet/gift/${T}x`)).toBeNull();
    expect(giftTokenFromNext("/wallet/gift/short")).toBeNull();
  });
});
