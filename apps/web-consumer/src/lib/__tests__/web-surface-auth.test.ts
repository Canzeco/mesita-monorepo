import { describe, expect, it } from "vitest";

import { webRequiresRegisteredAccount } from "../web-surface-auth";

describe("web surface auth", () => {
  it("lets anonymous guests browse discovery and places", () => {
    expect(webRequiresRegisteredAccount("/discover/scroll")).toBe(false);
    expect(webRequiresRegisteredAccount("/search")).toBe(false);
    expect(webRequiresRegisteredAccount("/place/abc")).toBe(false);
    expect(webRequiresRegisteredAccount("/get-the-app")).toBe(false);
  });

  it("sends account features to get-the-app", () => {
    expect(webRequiresRegisteredAccount("/me")).toBe(true);
    expect(webRequiresRegisteredAccount("/wallet")).toBe(true);
    expect(webRequiresRegisteredAccount("/new-visit")).toBe(true);
    expect(webRequiresRegisteredAccount("/visit/x")).toBe(true);
  });
});
